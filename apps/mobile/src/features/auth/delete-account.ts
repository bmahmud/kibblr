import * as Notifications from 'expo-notifications';

import { deleteLogin, reauthenticate } from '@/firebase/auth';
import { deleteHouseholdData } from '@/firebase/repositories/households';

/**
 * Deletes the account (Settings > Delete account): checks the password, then
 * deletes the household's data, then the login. Reminders already scheduled
 * on this phone are cancelled. Throws Firebase's error on a wrong password,
 * before anything is deleted.
 */
export async function deleteAccount(householdId: string, password: string): Promise<void> {
  const user = await reauthenticate(password);
  await deleteHouseholdData(householdId, user.uid);
  await Notifications.cancelAllScheduledNotificationsAsync();
  await deleteLogin(user);
}
