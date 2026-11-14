import { PHOTO_MAX } from '@kibblr/core';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

/** Photos are square thumbnails stored on their own Firestore document (no Cloud Storage). */
export const PET_PHOTO_SIZE = 256;
export const PRODUCT_PHOTO_SIZE = 384;

export type PhotoSource = 'camera' | 'library';

export type PickPhotoResult =
  { status: 'picked'; photo: string } | { status: 'canceled' } | { status: 'denied' } | { status: 'tooLarge' };

/**
 * Takes or picks a photo, crops it square in the system UI, and shrinks it to
 * a `size` px JPEG data URI small enough to keep on a Firestore document.
 */
export async function pickPhoto(source: PhotoSource, size: number): Promise<PickPhotoResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { status: 'denied' };
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) {
    return { status: 'canceled' };
  }

  // Decode at a reduced size so a 48 MP photo never sits in memory whole.
  const loaded = await ImageManipulator.manipulate(asset.uri, {
    maxWidth: size * 2,
    maxHeight: size * 2,
  }).renderAsync();
  const context = ImageManipulator.manipulate(loaded);
  if (loaded.width !== loaded.height) {
    // The crop UI should already have made it square; this covers when it didn't.
    const side = Math.min(loaded.width, loaded.height);
    context.crop({
      originX: (loaded.width - side) / 2,
      originY: (loaded.height - side) / 2,
      width: side,
      height: side,
    });
  }
  context.resize({ width: size, height: size });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
  if (!saved.base64) {
    return { status: 'canceled' };
  }
  const photo = `data:image/jpeg;base64,${saved.base64}`;
  return photo.length > PHOTO_MAX ? { status: 'tooLarge' } : { status: 'picked', photo };
}

export type PhotoAction = PhotoSource | 'remove';

/** Asks where the photo should come from: an action sheet on iOS, an alert on Android. Null if dismissed. */
export function askPhotoAction(title: string, hasPhoto: boolean): Promise<PhotoAction | null> {
  const actions: { action: PhotoAction; label: string }[] = [
    { action: 'camera', label: 'Take photo' },
    { action: 'library', label: 'Choose from library' },
    ...(hasPhoto ? [{ action: 'remove' as const, label: 'Remove photo' }] : []),
  ];
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: [...actions.map((a) => a.label), 'Cancel'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: hasPhoto ? actions.length - 1 : undefined,
        },
        (index) => resolve(actions[index]?.action ?? null),
      );
      return;
    }
    // Android alerts show at most three buttons; tapping outside cancels.
    Alert.alert(
      title,
      undefined,
      actions.map(({ action, label }) => ({
        text: label,
        style: action === 'remove' ? 'destructive' : 'default',
        onPress: () => resolve(action),
      })),
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
