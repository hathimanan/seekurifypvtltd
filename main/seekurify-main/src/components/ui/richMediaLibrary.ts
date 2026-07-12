import phishingExample from '../../assets/aiMedia/phishing-example.png';
import sslHandshakeImage from '../../assets/aiMedia/ssl-handshake.jpg';
// ✅ Define media items
export const mediaLibrary = {
  "ssl handshake": {
    type: "image" as const,
    src: sslHandshakeImage, // Use imported image
    caption: "SSL Handshake Process",
  },
  "firewall vs ids": {
    type: "table" as const,
    headers: ["Feature", "Firewall", "IDS"] as const,
    rows: [
      ["Purpose", "Block traffic", "Detect attacks"],
      ["Action", "Preventive", "Detective"],
    ] as const,
  },
  phishing: {
    type: "image" as const,
    src: phishingExample, // Use imported image
    caption: "Phishing Email Example",
  },
  "password policy": {
    type: "table" as const,
    headers: ["Rule", "Example"] as const,
    rows: [
      ["Minimum Length", "8+ characters"],
      ["Include Special Characters", "@, #, $ etc."],
    ] as const,
  },
} as const;

// ✅ Create type for media key
export type MediaKey = keyof typeof mediaLibrary;

// ✅ Create a general type for all media items
export type MediaItem = (typeof mediaLibrary)[MediaKey];

// ✅ Create a runtime-safe accessor function
export const getMediaItem = (key: string): MediaItem | null => {
  // TypeScript-safe runtime check
  if ((Object.keys(mediaLibrary) as string[]).includes(key)) {
    return mediaLibrary[key as MediaKey];
  }
  return null;
};
