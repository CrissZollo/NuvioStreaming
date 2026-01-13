import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  SpatialNavigationRoot,
  SpatialNavigationView,
  SpatialNavigationFocusableView,
} from 'react-tv-space-navigation';

/**
 * Test component for validating react-tv-space-navigation compatibility
 * with React 19 + Expo 54.
 *
 * Add this to Settings screen temporarily to test D-pad navigation.
 */
export const SpatialNavTest = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spatial Nav Test</Text>
      <Text style={styles.subtitle}>Use D-pad to move focus between boxes</Text>

      <SpatialNavigationRoot isActive={true}>
        <SpatialNavigationView direction="horizontal">
          {['One', 'Two', 'Three'].map((label) => (
            <SpatialNavigationFocusableView key={label}>
              {({ isFocused }) => (
                <View style={[styles.box, isFocused && styles.focused]}>
                  <Text style={[styles.text, isFocused && styles.focusedText]}>
                    {label}
                  </Text>
                  {isFocused && <Text style={styles.focusIndicator}>FOCUSED</Text>}
                </View>
              )}
            </SpatialNavigationFocusableView>
          ))}
        </SpatialNavigationView>
      </SpatialNavigationRoot>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    margin: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  box: {
    width: 120,
    height: 120,
    backgroundColor: '#333',
    margin: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focused: {
    backgroundColor: '#0066cc',
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
  text: {
    color: '#aaa',
    fontSize: 18,
    fontWeight: '600',
  },
  focusedText: {
    color: '#fff',
  },
  focusIndicator: {
    color: '#fff',
    fontSize: 10,
    marginTop: 8,
    opacity: 0.7,
  },
});

export default SpatialNavTest;
