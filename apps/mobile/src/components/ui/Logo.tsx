import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme-v2';

interface LogoProps {
  /** Hauteur du monogramme (px). */
  size?: number;
  /** Afficher le mot "Swalo" à côté du monogramme. */
  showWordmark?: boolean;
  /** Ton du texte : sur fond clair (marine) ou sur fond marine (clair). */
  tone?: 'marine' | 'light';
}

/**
 * Logo Swalo unifié. Sur fond blanc/clair on n'utilise que le monogramme « S »
 * (swalo_mark). Le mot "Swalo" est optionnel via showWordmark.
 */
export function Logo({ size = 40, showWordmark = false, tone = 'marine' }: LogoProps) {
  return (
    <View style={styles.row}>
      <Image
        source={require('../../../assets/swalo_mark.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      {showWordmark && (
        <Text
          style={[
            styles.wordmark,
            {
              fontSize: size * 0.6,
              color: tone === 'light' ? Colors.onMarine : Colors.primary[900],
            },
          ]}
        >
          Swalo
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
