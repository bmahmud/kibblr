import { PET_PHOTO_MAX } from '@kibblr/core';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Pet photos are square thumbnails stored on the pet document (no Cloud Storage). */
const PHOTO_SIZE = 256;

export type PhotoSource = 'camera' | 'library';

export type PickPhotoResult =
  { status: 'picked'; photo: string } | { status: 'canceled' } | { status: 'denied' } | { status: 'tooLarge' };

/**
 * Takes or picks a photo, crops it square in the system UI, and shrinks it to
 * a 256 px JPEG data URI small enough to keep on the pet's Firestore document.
 */
export async function pickPetPhoto(source: PhotoSource): Promise<PickPhotoResult> {
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
    maxWidth: PHOTO_SIZE * 2,
    maxHeight: PHOTO_SIZE * 2,
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
  context.resize({ width: PHOTO_SIZE, height: PHOTO_SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
  if (!saved.base64) {
    return { status: 'canceled' };
  }
  const photo = `data:image/jpeg;base64,${saved.base64}`;
  return photo.length > PET_PHOTO_MAX ? { status: 'tooLarge' } : { status: 'picked', photo };
}
