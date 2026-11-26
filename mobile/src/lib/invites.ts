import { Alert, Share } from 'react-native';
import { api, errorText } from './api';
import { config, features } from './config';

export const PENDING_INVITE_KEY = 'fff-pending-invite';

/** Opens the share sheet with an invite: a personal invite link when friends are on, else the app link. */
export async function shareInvite() {
  try {
    if (!features.friends) {
      await Share.share({ message: `How far from fries can you get? Play McFarthest: ${config.webUrl}` });
      return;
    }
    const code = await api.createInvite();
    await Share.share({ message: `Play McFarthest with me: ${config.webUrl}/i/${code}` });
  } catch (e) {
    Alert.alert('Hmm', errorText(e));
  }
}
