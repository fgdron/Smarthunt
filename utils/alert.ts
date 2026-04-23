import { Alert, Platform } from 'react-native';

interface Button {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export function showAlert(title: string, message: string, buttons: Button[] = [{ text: 'OK' }]) {
  if (Platform.OS === 'web') {
    const cancelBtn = buttons.find(b => b.style === 'cancel');
    const confirmBtn = buttons.find(b => b.style !== 'cancel');
    if (buttons.length > 1) {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) confirmBtn?.onPress?.();
      else cancelBtn?.onPress?.();
    } else {
      window.alert(`${title}\n\n${message}`);
      buttons[0]?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}
