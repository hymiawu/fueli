// Drop-in for React Native's Alert: Alert.alert is a no-op on react-native-web, so use browser dialogs there.
import { Alert as RNAlert, Platform } from 'react-native';

export const Alert = {
  alert(title, message, buttons) {
    if (Platform.OS !== 'web') return RNAlert.alert(title, message, buttons);
    const text = [title, message].filter(Boolean).join('\n\n');
    const cancel = buttons?.find((b) => b.style === 'cancel');
    const action = buttons?.find((b) => b.style !== 'cancel');
    if (cancel && action) {
      if (window.confirm(text)) action.onPress?.();
      else cancel.onPress?.();
      return;
    }
    window.alert(text);
    action?.onPress?.();
  },
};
