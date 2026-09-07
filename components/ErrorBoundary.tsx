import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Wrapper component to use hooks
function ErrorBoundaryContent({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-dark-bg p-6">
      <Text className="text-lg font-semibold text-error mb-2">{t('common.errorBoundary.title')}</Text>
      <Text className="text-sm text-dark-text-secondary text-center mb-6">
        {error?.message || t('common.errorBoundary.message')}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        className="bg-accent rounded-xl px-8 py-4"
      >
        <Text className="text-dark-bg font-bold">{t('common.errorBoundary.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorBoundaryContent error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
