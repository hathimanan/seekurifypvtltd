import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { ShieldCheck, Clock, User, Lock } from "lucide-react";

interface ShareMeta {
  siteName: string;
  sharedBy: string;
  expiresAt: string;
  viewOnce: boolean;
}

const SharedPasswordLanding = () => {
  // Read both params in one call and prefer token for share links
  const { token, shareId } = useParams<{ token?: string; shareId?: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Use token (preferred) for share links; bail early if missing
    if (!token && !shareId) {
      setError("Invalid or malformed share link");
      setLoading(false);
      return;
    }

    const idToUse = token || shareId;

    const fetchShareMeta = async () => {
      try {
        // Backend auth routes are mounted under /api/auth
        // Backend auth routes are mounted under /api/auth
        const res = await fetch(`/api/auth/share/${idToUse}/meta`);

        // If not OK, try to read text for a helpful error message
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Invalid or expired link");
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error("Unexpected non-JSON response from server: " + text);
        }

        const data = await res.json();
        setMeta(data);
      } catch (err: any) {
        setError(err.message || "Unable to load shared password");
      } finally {
        setLoading(false);
      }
    };

    fetchShareMeta();
  }, [token, shareId]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Verifying secure link…
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="max-w-sm p-6 text-center">
          <Lock className="mx-auto mb-3 text-red-500" />
          <p className="text-red-600 font-medium">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md rounded-2xl shadow-lg">
        <CardContent className="p-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-2">
            <ShieldCheck className="w-10 h-10 text-blue-600" />
            <h2 className="text-xl font-semibold">
              A password has been shared with you
            </h2>
            <p className="text-sm text-gray-500">
              This secret is protected and not visible yet.
            </p>
          </div>

          {/* Metadata */}
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-500" />
              <span>
                <strong>Website:</strong> {meta?.siteName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <span>
                <strong>Shared by:</strong> {meta?.sharedBy}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>
                <strong>Expires:</strong>{" "}
                {meta?.expiresAt ? new Date(meta.expiresAt).toLocaleString() : '—'}
              </span>
            </div>

            {meta?.viewOnce && (
              <p className="text-xs text-orange-600">
                ⚠️ This password can be viewed only once
              </p>
            )}
          </div>

          {/* CTA */}
          <Button
            className="w-full rounded-xl"
            onClick={() => navigate(`/share/${token || shareId}/verify${window.location.hash || ''}`)}
          >
            Verify & View Password
          </Button>

          {/* Footer note */}
          <p className="text-xs text-gray-400 text-center">
            Shared securely via your password manager
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharedPasswordLanding;
