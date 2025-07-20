import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, Chip } from 'react-native-paper';
import { colors, spacing, fontSize } from '../theme/colors';

const SitesScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Construction Sites</Text>
        
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.header}>
              <Title>Résidence Les Jardins</Title>
              <Chip mode="outlined" textStyle={styles.chipText}>Active</Chip>
            </View>
            <Paragraph>Lyon • Started: Jan 15, 2024</Paragraph>
            <Paragraph>Luxury residential complex with 50 apartments</Paragraph>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>Progress: 34%</Text>
              <Text style={styles.budgetText}>Budget: €2.5M</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.header}>
              <Title>Centre Commercial Horizon</Title>
              <Chip mode="outlined" textStyle={styles.chipText}>Active</Chip>
            </View>
            <Paragraph>Marseille • Started: Mar 1, 2024</Paragraph>
            <Paragraph>Renovation and expansion of shopping center</Paragraph>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>Progress: 25%</Text>
              <Text style={styles.budgetText}>Budget: €1.8M</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.infoCard}>
          <Card.Content>
            <Title>Site Management Features</Title>
            <Paragraph>📋 Task assignment and tracking</Paragraph>
            <Paragraph>👥 Team coordination</Paragraph>
            <Paragraph>📊 Progress monitoring</Paragraph>
            <Paragraph>💰 Budget tracking</Paragraph>
            <Paragraph>📅 Timeline management</Paragraph>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  card: {
    marginBottom: spacing.md,
    elevation: 3,
  },
  infoCard: {
    marginBottom: spacing.md,
    elevation: 2,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  chipText: {
    fontSize: fontSize.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '500',
  },
  budgetText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
});

export default SitesScreen; 