import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    console.error('🔴 ERROR BOUNDARY CAUGHT ERROR:', error);
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔴 ERROR DETAILS:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>⚠️ Erreur Détectée</Text>
            <Text style={styles.subtitle}>L'application a rencontré un problème</Text>
          </View>

          <ScrollView style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Message d'erreur:</Text>
            <Text style={styles.errorText}>{this.state.error?.message || 'Erreur inconnue'}</Text>

            {this.state.error?.stack && (
              <>
                <Text style={styles.errorTitle}>Stack trace:</Text>
                <Text style={styles.stackText}>{this.state.error.stack}</Text>
              </>
            )}

            {this.state.errorInfo?.componentStack && (
              <>
                <Text style={styles.errorTitle}>Component stack:</Text>
                <Text style={styles.stackText}>{this.state.errorInfo.componentStack}</Text>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>📋 Ces logs sont disponibles dans la console</Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#dc2626',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  errorContainer: {
    flex: 1,
    padding: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    fontFamily: 'monospace',
  },
  stackText: {
    fontSize: 12,
    color: '#4b5563',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    fontFamily: 'monospace',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default ErrorBoundary;
