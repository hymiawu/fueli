// Bottom-sheet container. On web, React Native's Modal renders into <body>, outside the phone frame in App.js,
// so the sheet would cover the whole browser window. There it is drawn as an overlay inside the current
// screen instead; on phones it stays a native Modal.
import React from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';

export default function Sheet({ visible = true, onClose, children }) {
  if (!visible) return null;
  if (Platform.OS !== 'web') {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={onClose}>
        {children}
      </Modal>
    );
  }
  return <View style={styles.overlay}>{children}</View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
});
