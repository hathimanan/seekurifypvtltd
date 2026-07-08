import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Footer from "./ui/FooterBeforeLogin";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "../services/api";

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  attachment?: File | null;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  attachment?: string;
}

const PublicContactPage: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    subject: "",
    message: "",
    attachment: null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<string>("");
  const navigate = useNavigate();

  const validate = () => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required.";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
      newErrors.email = "Enter a valid email address (e.g., test@gmail.com).";
    }
    if (!formData.subject.trim()) newErrors.subject = "Subject is required.";
    if (!formData.message.trim()) newErrors.message = "Message cannot be empty.";
    if (formData.attachment) {
      const validTypes = ["application/pdf", "image/png", "image/jpeg"];
      if (!validTypes.includes(formData.attachment.type))
        newErrors.attachment = "Only PDF, PNG, or JPG files are allowed.";
      if (formData.attachment.size > 5 * 1024 * 1024)
        newErrors.attachment = "File size must be under 5MB.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus("Sending...");

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("email", formData.email);
      formDataToSend.append("subject", formData.subject);
      formDataToSend.append("message", formData.message);
      if (formData.attachment) formDataToSend.append("attachment", formData.attachment);

      const res = await axios.post(`${API_BASE_URL}/contact`, formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatus(res.data.message);
      setFormData({ name: "", email: "", subject: "", message: "", attachment: null });
    } catch (err) {
      console.error("Contact form error:", err);
      setStatus("Error sending message.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#07111f] text-white">
      {/* Nav */}
      <header className="max-w-7xl mx-auto w-full px-6 lg:px-10 pt-6">
        <div className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 backdrop-blur-xl px-5 py-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/15 border border-cyan-300/20">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-300">Seekurify</p>
              <p className="text-xs text-slate-400">AI Security Platform</p>
            </div>
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 rounded-lg shadow hover:scale-105 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-grow flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg bg-white shadow-xl rounded-3xl p-8 border border-slate-200">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-extrabold text-gray-800">Talk to Us</h2>
            <p className="text-gray-500 mt-1">We'll get back to you shortly!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {["name", "email", "subject"].map((field) => (
              <div key={field}>
                <label className="block text-sm font-semibold text-gray-600 mb-1 capitalize">
                  {field}*
                </label>
                <input
                  name={field}
                  type={field === "email" ? "email" : "text"}
                  value={(formData as any)[field]}
                  onChange={handleChange}
                  placeholder={`Enter your ${field}`}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition
                    ${errors[field as keyof FormErrors]
                      ? "border-red-500 focus:ring-red-300"
                      : "border-gray-300 focus:ring-amber-400"
                    }`}
                />
                {errors[field as keyof FormErrors] && (
                  <p className="text-sm text-red-600 mt-1">{errors[field as keyof FormErrors]}</p>
                )}
              </div>
            ))}

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Message*</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Type your message..."
                className={`w-full px-4 py-3 border rounded-xl h-36 resize-none focus:outline-none focus:ring-2 transition
                  ${errors.message ? "border-red-500 focus:ring-red-300" : "border-gray-300 focus:ring-amber-400"}`}
              />
              {errors.message && (
                <p className="text-sm text-red-600 mt-1">{errors.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Attachment</label>
              <input
                type="file"
                name="attachment"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, attachment: e.target.files?.[0] || null }))
                }
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 border-gray-300 focus:ring-amber-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
              />
              {errors.attachment && (
                <p className="text-sm text-red-600 mt-1">{errors.attachment}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 px-4 rounded-xl text-lg transition-shadow shadow-md hover:shadow-lg"
            >
              Send Message
            </button>
          </form>

          {status && (
            <p className="mt-4 text-center text-sm font-medium text-gray-700">{status}</p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PublicContactPage;
