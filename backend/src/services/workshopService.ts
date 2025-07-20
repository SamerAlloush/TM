import { IInterventionRequest } from '../models/InterventionRequest';
import { User } from '../models/User';
import { globalSMTPTransport } from './globalEmailService';
import nodemailer from 'nodemailer';

export interface WorkshopTransferResult {
  success: boolean;
  transferId?: string;
  error?: string;
  notificationsSent?: {
    email: boolean;
    database: boolean;
  };
}

/**
 * Workshop Transfer Service
 * Handles the automatic transfer of intervention requests to the workshop
 */
export class WorkshopService {
  
  /**
   * Transfer intervention request to workshop
   */
  static async transferInterventionRequest(
    request: IInterventionRequest,
    performedBy: string
  ): Promise<WorkshopTransferResult> {
    try {
      console.log(`🔄 Transferring intervention request ${request._id?.toString() || request.id} to workshop...`);
      
      // 1. Update request status (already done in the model method)
      await request.transferToWorkshop(performedBy);
      
      // 2. Get workshop users for notifications
      const workshopUsers = await User.find({ 
        role: 'Workshop', 
        isActive: true 
      }).select('firstName lastName email');
      
      // 3. Send notifications
      const notificationResults = await this.sendWorkshopNotifications(request, workshopUsers);
      
      // 4. Log successful transfer
      console.log(`✅ Workshop Transfer Complete: Request ${request._id?.toString() || request.id}`);
      console.log(`   - Email notifications: ${notificationResults.email ? 'Sent' : 'Failed'}`);
      console.log(`   - Database updated: ${notificationResults.database ? 'Success' : 'Failed'}`);
      
      return {
        success: true,
        transferId: request._id?.toString() || request.id,
        notificationsSent: notificationResults
      };
      
    } catch (error) {
      console.error(`❌ Workshop transfer failed for request ${request._id?.toString() || request.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transfer error'
      };
    }
  }
  
  /**
   * Send notifications to workshop team
   */
  private static async sendWorkshopNotifications(
    request: IInterventionRequest,
    workshopUsers: any[]
  ): Promise<{ email: boolean; database: boolean }> {
    const results = {
      email: false,
      database: true // Database update is handled by the model
    };
    
    try {
      // Send email notifications if configured
      if (globalSMTPTransport && workshopUsers.length > 0) {
        results.email = await this.sendEmailNotifications(request, workshopUsers);
      } else {
        console.log('⚠️ No email configuration or workshop users found for notifications');
      }
      
      // Additional notification mechanisms can be added here:
      // - Push notifications
      // - SMS notifications
      // - Slack/Teams integration
      // - Workshop system API calls
      
    } catch (error) {
      console.error('Workshop notification error:', error);
    }
    
    return results;
  }
  
  /**
   * Send email notifications to workshop team
   */
  private static async sendEmailNotifications(
    request: IInterventionRequest,
    workshopUsers: any[]
  ): Promise<boolean> {
    try {
      if (!globalSMTPTransport) {
        console.log('⚠️ Global SMTP transport not available for workshop notifications');
        return false;
      }
      
      // Populate request details if needed
      await request.populate([
        { path: 'submittedBy', select: 'firstName lastName email role' },
        { path: 'relatedSite', select: 'name address city' }
      ]);
      
      const submitter = request.submittedBy as any;
      const site = request.relatedSite as any;
      
      // Create email content
      const emailContent = this.generateEmailContent(request, submitter, site);
      
      // Send to all workshop users
      const emailPromises = workshopUsers.map(user => 
        this.sendIndividualEmail(user, emailContent)
      );
      
      const emailResults = await Promise.allSettled(emailPromises);
      const successCount = emailResults.filter(result => result.status === 'fulfilled').length;
      
      console.log(`📧 Workshop Email Notifications: ${successCount}/${workshopUsers.length} sent successfully`);
      
      return successCount > 0;
      
    } catch (error) {
      console.error('Email notification error:', error);
      return false;
    }
  }
  
  /**
   * Generate email content for workshop notification
   */
  private static generateEmailContent(
    request: IInterventionRequest,
    submitter: any,
    site?: any
  ) {
    const priorityEmoji = {
      'Low': '🟢',
      'Medium': '🟡',
      'High': '🟠',
      'Urgent': '🔴'
    };
    
    const emergencyText = request.isEmergency ? '🚨 EMERGENCY REQUEST 🚨' : '';
    
    return {
      subject: `${emergencyText} New Workshop Intervention Request - ${request.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin: 0;">
              🔧 New Workshop Intervention Request
              ${request.isEmergency ? '<br><span style="color: #e74c3c;">🚨 EMERGENCY 🚨</span>' : ''}
            </h2>
          </div>
          
          <div style="background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h3 style="color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
              ${request.title}
            </h3>
            
            <div style="margin: 15px 0;">
              <strong>Priority:</strong> ${priorityEmoji[request.priority]} ${request.priority}
            </div>
            
            <div style="margin: 15px 0;">
              <strong>Submitted by:</strong> ${submitter?.firstName} ${submitter?.lastName} (${submitter?.role})
            </div>
            
            ${site ? `
            <div style="margin: 15px 0;">
              <strong>Site:</strong> ${site.name} - ${site.city}
            </div>
            ` : ''}
            
            ${request.equipmentLocation ? `
            <div style="margin: 15px 0;">
              <strong>Equipment Location:</strong> ${request.equipmentLocation}
            </div>
            ` : ''}
            
            <div style="margin: 15px 0;">
              <strong>Description:</strong>
              <div style="background: #f8f9fa; padding: 10px; border-left: 4px solid #3498db; margin-top: 5px;">
                ${request.description}
              </div>
            </div>
            
            ${request.equipmentDetails ? `
            <div style="margin: 15px 0;">
              <strong>Equipment Details:</strong>
              <div style="background: #f8f9fa; padding: 10px; border-left: 4px solid #3498db; margin-top: 5px;">
                ${request.equipmentDetails}
              </div>
            </div>
            ` : ''}
            
            <div style="margin: 20px 0; padding: 15px; background: #e8f5e8; border-radius: 5px;">
              <strong>📋 Next Steps:</strong>
              <ul style="margin: 10px 0;">
                <li>Review the intervention request details</li>
                <li>Assign a workshop member if needed</li>
                <li>Update the status when work begins</li>
                <li>Add comments for communication</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
              <p style="color: #7f8c8d; font-size: 14px;">
                Request ID: ${request._id?.toString() || request.id}<br>
                Submitted: ${new Date(request.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 15px; background: #ecf0f1; border-radius: 5px;">
            <p style="margin: 0; color: #7f8c8d; font-size: 12px;">
              This is an automated notification from TM Paysage Site Manager<br>
              Please do not reply to this email
            </p>
          </div>
        </div>
      `,
      text: `
        New Workshop Intervention Request ${request.isEmergency ? '(EMERGENCY)' : ''}
        
        Title: ${request.title}
        Priority: ${request.priority}
        Submitted by: ${submitter?.firstName} ${submitter?.lastName} (${submitter?.role})
        ${site ? `Site: ${site.name} - ${site.city}` : ''}
        ${request.equipmentLocation ? `Equipment Location: ${request.equipmentLocation}` : ''}
        
        Description:
        ${request.description}
        
        ${request.equipmentDetails ? `Equipment Details:\n${request.equipmentDetails}` : ''}
        
        Request ID: ${request._id?.toString() || request.id}
        Submitted: ${new Date(request.createdAt).toLocaleString()}
      `
    };
  }
  
  /**
   * Send individual email to workshop user
   */
  private static async sendIndividualEmail(user: any, emailContent: any): Promise<void> {
    if (!globalSMTPTransport) {
      throw new Error('SMTP transport not available');
    }
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      headers: {
        'X-Priority': '1', // High priority for workshop notifications
        'X-Workshop-Notification': 'true'
      }
    };
    
    await globalSMTPTransport.sendMail(mailOptions);
    console.log(`📧 Workshop notification sent to: ${user.email}`);
  }
  
  /**
   * Get workshop team information
   */
  static async getWorkshopTeam(): Promise<any[]> {
    try {
      return await User.find({ 
        role: 'Workshop', 
        isActive: true 
      }).select('firstName lastName email assignedSites');
    } catch (error) {
      console.error('Error fetching workshop team:', error);
      return [];
    }
  }
  
  /**
   * Test workshop notification system
   */
  static async testNotificationSystem(): Promise<{ success: boolean; message: string }> {
    try {
      const workshopUsers = await this.getWorkshopTeam();
      
      if (workshopUsers.length === 0) {
        return {
          success: false,
          message: 'No active workshop users found'
        };
      }
      
      if (!globalSMTPTransport) {
        return {
          success: false,
          message: 'Email service not configured'
        };
      }
      
      return {
        success: true,
        message: `Workshop notification system ready. ${workshopUsers.length} workshop users found.`
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Notification system test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 