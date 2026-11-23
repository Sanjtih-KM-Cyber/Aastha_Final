import { Capacitor } from '@capacitor/core';

/**
 * Save a text file the user asked for. Web: normal browser download.
 * Phone app: WebViews ignore <a download>, so write it to the app's cache and open the share sheet
 * (Save to Files / Drive / send to yourself).
 */
export const saveTextFile = async (filename: string, text: string, mime = 'application/json'): Promise<'downloaded' | 'shared'> => {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const written = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, url: written.uri, dialogTitle: 'Save your Aastha data' });
    return 'shared';
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
};
