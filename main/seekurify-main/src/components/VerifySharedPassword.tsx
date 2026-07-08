import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { API_BASE_URL } from "../services/api";

const VerifySharedPassword = () => {
  const { shareId } = useParams<{ shareId: string }>();




    const [key, setKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sharedPassword, setSharedPassword] = useState<any>(null);

  // Prevent duplicate/parallel fetch+decrypt in dev (React StrictMode can double-run effects)
  const inFlightRef = useRef(false);
  const fetchedRef = useRef(false);

  if (!shareId) {
    return <div className="p-4">Invalid share link</div>;
  }

  // Convert base64 -> Uint8Array helper
  const base64ToUint8Array = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const decryptSharedPayload = async (payload: any, keyValue: string) => {
    try {
      const { encryptedData, iv, salt } = payload;
      if (!encryptedData || !iv || !salt) throw new Error('Invalid encrypted payload');

      const enc = new TextEncoder();
      const dec = new TextDecoder();

      const saltBuf = base64ToUint8Array(salt);
      const ivBuf = base64ToUint8Array(iv);
      const encryptedBuf = base64ToUint8Array(encryptedData);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(keyValue),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuf },
        key,
        encryptedBuf
      );

      const plaintext = dec.decode(decryptedBuffer);

      // Try JSON.parse but fall back to raw string if the encrypted payload was a plain string
      try {
        return JSON.parse(plaintext);
      } catch (parseErr) {
        // Not JSON — return as plain string
        return plaintext;
      }
    } catch (err) {
      throw new Error('Failed to decrypt shared payload: ' + (err as any).message);
    }
  };

  const fetchSharedPassword = async (providedKey?: string) => {
    // Avoid duplicate concurrent attempts
    if (inFlightRef.current) return;
    if (fetchedRef.current) return;

    inFlightRef.current = true;
    try {
      setLoading(true);
      setKeyError('');

      const keyToUse = providedKey ?? key;
      if (!keyToUse) {
        setKeyError('No key provided. Add the key after the URL fragment (after #) or paste it below.');
        return;
      }

      const token = localStorage.getItem('token');
      const headers: Record<string,string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/auth/share/${shareId}`, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to fetch shared password');
      }

      const data = await res.json();

      const decrypted = await decryptSharedPayload(data, keyToUse);

      // If decrypted is a plain string (legacy behaviour), construct an object using metadata
      if (typeof decrypted === 'string') {
        setSharedPassword({
          username: data.metadata?.username || '',
          password: decrypted,
          notes: data.metadata?.notes || ''
        });
      } else {
        setSharedPassword(decrypted);
      }

      fetchedRef.current = true;

      // Mark the share as consumed (one-time) AFTER successful decryption
      try {
        const consumeRes = await fetch(`${API_BASE_URL}/auth/share/${shareId}/consume`, { method: 'POST' });
        if (!consumeRes.ok) {
          const text = await consumeRes.text();
          console.warn('Failed to mark share as used:', text);
        }
      } catch (consumeErr) {
        console.warn('Consume request failed:', consumeErr);
      }

      // Remove fragment from URL for privacy
      try {
        if (window.history && window.history.replaceState) {
          const newUrl = window.location.pathname + window.location.search;
          window.history.replaceState({}, '', newUrl);
        }
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      setKeyError(err.message || 'Failed to fetch or decrypt shared password');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  // Auto-run if key is present in the URL fragment
  useEffect(() => {
    const fragment = decodeURIComponent(window.location.hash.slice(1) || '');
    if (fragment) {
      setKey(fragment);
      // try immediately
      fetchSharedPassword(fragment);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  // ✅ Display shared password after successful decryption
  if (sharedPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Shared Password</h2>

          <p className="text-gray-700 mb-2">
            Share ID: <span className="font-mono text-blue-600">{shareId}</span>
          </p>
          <p className="text-gray-700 mb-2">
            Username: <span className="font-mono">{sharedPassword.username}</span>
          </p>
          <p className="text-gray-700 mb-2">
            Password: <span className="font-mono">{sharedPassword.password}</span>
          </p>
          {sharedPassword.notes && (
            <p className="text-gray-700 mb-2">Notes: {sharedPassword.notes}</p>
          )}
        </div>
      </div>
    );
  }

  // Show key input if no key was present or decryption failed
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-sm">
          <h2 className="text-xl font-bold mb-4 text-center">Provide decryption key</h2>

          <p className="text-sm text-gray-600 text-center mb-4">
            The secret key is usually included in the link as a URL fragment (after the <code>#</code>). If your link did not include it, paste it here to decrypt the shared password. Keep it secret — the server never sees this key.
          </p>

          {keyError && (
            <div className="text-red-600 text-sm mb-3 text-center">{keyError}</div>
          )}

          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste secret key (from URL fragment)"
            className="w-full px-4 py-2 border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <Button
            onClick={() => fetchSharedPassword()}
            disabled={loading}
            className="w-full bg-blue-600 text-white hover:bg-blue-700 py-2 rounded-md"
            >
            {loading ? 'Decrypting...' : 'View Password'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VerifySharedPassword;
