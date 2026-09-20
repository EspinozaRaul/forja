import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, fontWeights } from '../lib/theme/tokens';
import i18n from '../lib/i18n';

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
    if (!this.state.hasError) return this.props.children;

    // Release must not surface internals. The raw stack and the React component
    // stack expose file paths and library versions, and `error.message` is an
    // English internal string; on a shared device that lands in a stranger's
    // hands. Development keeps all of it so the crash stays debuggable.
    //
    // The generic copy is read off the i18n instance instead of the
    // `useTranslation` hook because this boundary sits OUTSIDE the
    // I18nextProvider in `app/_layout.tsx` on purpose: it has to render a
    // fallback while the providers below it are the thing that broke.
    return (
      <View style={styles.container}>
        <Text style={styles.title}>ERROR</Text>
        <ScrollView style={styles.scroll}>
          {__DEV__ ? (
            <>
              <Text style={styles.message}>{this.state.error?.message}</Text>
              {this.state.error?.stack && (
                <Text style={styles.stack}>{this.state.error.stack}</Text>
              )}
              {this.state.errorInfo && (
                <Text style={styles.stack}>{this.state.errorInfo}</Text>
              )}
            </>
          ) : (
            <Text style={styles.message}>{i18n.t('common.unexpectedError')}</Text>
          )}
        </ScrollView>
      </View>
    );
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
    color: colors.error,
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bodySemiBold,
    fontWeight: fontWeights.bold,
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
