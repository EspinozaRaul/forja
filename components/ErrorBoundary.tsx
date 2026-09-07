import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../lib/theme/tokens';

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo: errorInfo.componentStack || '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>ERROR</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>{this.state.error?.message}</Text>
            {this.state.error?.stack && (
              <Text style={styles.stack}>{this.state.error.stack}</Text>
            )}
            {this.state.errorInfo && (
              <Text style={styles.stack}>{this.state.errorInfo}</Text>
            )}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: '#ff0000',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  message: {
    color: '#ff6666',
    fontSize: 16,
    marginBottom: 12,
  },
  stack: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
