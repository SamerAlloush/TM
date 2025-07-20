import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button } from 'react-native-paper';
import { colors } from '../theme/colors';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retry: () => void;
}

const DefaultErrorFallback: React.FC<ErrorBoundaryFallbackProps> = ({ error, retry }) => (
  <View style={styles.container}>
    <Card style={styles.errorCard}>
      <Card.Content>
        <Title style={styles.errorTitle}>🚨 Something went wrong</Title>
        <Paragraph style={styles.errorMessage}>
          We're sorry, but an unexpected error occurred. This has been logged and our team will investigate.
        </Paragraph>
        
        {__DEV__ && error && (
          <View style={styles.debugContainer}>
            <Paragraph style={styles.debugTitle}>Debug Information:</Paragraph>
            <Paragraph style={styles.debugText}>{error.message}</Paragraph>
            {error.stack && (
              <Paragraph style={styles.debugStack}>
                {error.stack.substring(0, 500)}...
              </Paragraph>
            )}
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          <Button 
            mode="contained" 
            onPress={retry}
            style={styles.retryButton}
            icon="refresh"
          >
            Try Again
          </Button>
        </View>
      </Card.Content>
    </Card>
  </View>
);

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error, 
      errorInfo: null 
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Log error to crash reporting service if available
    // Example: crashlytics().recordError(error);
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          retry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  errorCard: {
    width: '100%',
    maxWidth: 400,
  },
  errorTitle: {
    textAlign: 'center',
    color: colors.error,
    marginBottom: 16,
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  debugContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 14,
  },
  debugText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.error,
    marginBottom: 8,
  },
  debugStack: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#666',
    lineHeight: 14,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  retryButton: {
    width: '100%',
  },
});

export default ErrorBoundary; 