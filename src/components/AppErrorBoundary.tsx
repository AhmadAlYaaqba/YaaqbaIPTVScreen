import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import TVTouchable from '../tv/TVTouchable';
import { colors, radii, space } from '../theme/colors';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Last line of defense. A malformed provider payload or a player edge case
 * that throws during render would otherwise leave a blank screen with no way
 * out on a TV. Shows the message and remounts the tree on "Try again".
 */
export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error('Unhandled render error:', error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <View style={styles.root} accessibilityRole="alert">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message} numberOfLines={4}>
          {error.message || String(error)}
        </Text>
        <TVTouchable
          style={styles.button}
          onPress={this.handleReset}
          hasTVPreferredFocus
          accessibilityRole="button"
          accessibilityLabel="Try again">
          <Text style={styles.buttonText}>Try again</Text>
        </TVTouchable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.s8,
  },
  title: {
    color: colors.fg,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: space.s2,
    textAlign: 'center',
  },
  message: {
    color: colors.fgMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: space.s8,
    maxWidth: 520,
  },
  button: {
    backgroundColor: colors.indigo,
    paddingVertical: space.s4,
    paddingHorizontal: space.s8,
    borderRadius: radii.md,
  },
  buttonText: {
    color: colors.fg,
    fontSize: 16,
    fontWeight: '700',
  },
});
