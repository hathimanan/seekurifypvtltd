import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import { ArrowLeft, BookOpen, CheckCircle2, XCircle, Clock, ChevronRight, RotateCcw } from "lucide-react";
import AppSidebar from "./ui/AppSidebar";
import { API_BASE_URL } from '../services/api';
import SecurityChatbotIcon from "./ui/ChatbotIcon";
import BotChat from "./ui/BotChat";
import { tips } from '../config/securityTips';
import type { QuizQuestion } from '../config/quizQuestions';

interface Attack {
  title: string;
  date: string;
  description: string;
  link: string;
}

interface MediumArticle {
  title: string;
  date: string;
  description: string;
  link: string;
  thumbnail?: string;
}


interface HeaderProps {
  token: string;
  handleLogout: () => void;
  profileImage?: string; // ✅ new prop
}


interface Tip {  // Rename from 'tips' to 'Tip' for proper naming convention
  title: string;
  text: string;
  description: string;
  proTips?: string[];
  importance?: string[];
  realLifeExample?: string;
  link?: string;
  quickTips?: string[];
  bestPractices?: string[];
  backupMethods?: string[];
  backupFrequency?: string;
  backupStrategies?: string[];
  whyBackupsMatter?: string;
  additionalTip?: string;
  additionalTips?: string[];
  verificationSteps?: string[];
  publicWifiRisks?: string[];
  safePractices?: string[];
  otpRisks?: string[];
  antivirusBenefits?: string[];
  updateBenefits?: string[];
  authenticationMethods?: string[];
  passwordTips?: string[];
  passwordBenefits?: string[];
  authenticationBenefits?: string[];
  urlVerificationSteps?: string[];
  urlAdditionalTips?: string[];
  urlFinalNote?: string;
  howTo?: string[];
  tools?: string[];
  recoverySteps?: string[];
  quickTip?: string;
  signs?: string[];
  reference?: string[];
}

const mockRecentAttacks: Attack[] = [
  {
    title: "Workday Breach via Social Engineering",
    date: "August 2025",
    description:
      "HR platform Workday was compromised in a phishing campaign that exposed customer names, emails, and phone numbers.",
    link: "https://www.techradar.com/pro/security/hackers-breach-hr-firm-workday-is-it-the-latest-salesforce-crm-attack-victim",
  },
  {
    title: "Colt Telecom Hit by Warlock Ransomware",
    date: "August 2025",
    description:
      "UK’s Colt Technology Services suffered a ransomware attack exploiting a Microsoft SharePoint vulnerability.",
    link: "https://www.itpro.com/security/cyber-attacks/uk-telecoms-firm-takes-systems-offline-after-cyber-attack",
  },
  {
    title: "ShinyHunters Breach Impacts Google Salesforce Data",
    date: "August 2025",
    description:
      "Google was among victims of the ShinyHunters Salesforce breach, exposing sensitive small-business contact data.",
    link: "https://www.itpro.com/security/cyber-attacks/google-cyber-researchers-were-tracking-the-shinyhunters-groups-salesforce-attacks-then-realized-theyd-fallen-victim",
  },
  {
    title: "Marks & Spencer Recovers After £300m Cyberattack Loss",
    date: "August 2025",
    description:
      "M&S online services are back after an April attack that caused significant losses, showing the long-term impact of breaches.",
    link: "https://www.reuters.com/business/retail-consumer/ms-food-sales-growth-accelerates-cyber-hack-impact-fades-nielseniq-data-shows-2025-08-20",
  },
  {
    title: "AI Deepfake Scams Target Global Corporates",
    date: "August 2025",
    description:
      "Fraudsters using AI-powered deepfakes to impersonate executives have caused global companies losses exceeding $200m.",
    link: "https://www.wsj.com/articles/ai-drives-rise-in-ceo-impersonator-scams-2bd675c4",
  },
];

const mockMediumArticles: MediumArticle[] = [
  {
    title: "Security in the Era of Phishing",
    date: "August 2025",
    description:
      "Insights into phishing tactics and how to safeguard against evolving threats.",
    link: "https://medium.com/@hathimanan/security-in-the-era-of-phishing-75203e5c92c9",
  },
  {
    title: "Ransomware Attacks and Akira",
    date: "August 2025",
    description:
      "Exploring the Akira ransomware group and the broader impact of ransomware on organizations.",
    link: "https://medium.com/@hathimanan/ransomware-attacks-and-akira-ec9ef87737d8",
  },
  {
    title: "Security – The Core Aspect of Our Data",
    date: "July 2025",
    description:
      "Understanding why security is the foundation of modern digital trust.",
    link: "https://medium.com/@hathimanan/security-the-core-aspect-of-our-data-56843d7d040f",
  },
  {
    title: "Data Security Chapter 2: Fundamentals of Security",
    date: "July 2025",
    description:
      "A deep dive into the essential principles and practices of data security.",
    link: "https://medium.com/@hathimanan/data-security-chapter-2-fundamentals-of-security-5de97f0f0fb1",
  },
  {
    title: "AI, Cloud Computing & Cybersecurity – The Thin Line Between Them",
    date: "June 2025",
    description:
      "Exploring the intersection of AI, cloud, and cybersecurity in the digital era.",
    link: "https://medium.com/@hathimanan/ai-cloud-computing-cybersecurity-the-thin-line-between-them-f47ea204e875",
  },
];

export const SecurityAwareness: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [profileImage, setProfileImage] = useState<string>(""); // ✅ state for header
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [selectedTip, setSelectedTip] = useState<Tip | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mediumArticles, setMediumArticles] = useState<MediumArticle[]>(mockMediumArticles);
  const [articlesLoading, setArticlesLoading] = useState(true);
const [featureFlags, setFeatureFlags] = useState({
  securityChatbotEnabled: false,
  // ... other flags
});

  const [quizPhase, setQuizPhase]           = useState<'intro' | 'quiz' | 'result'>('intro');
  const [quizQuestions, setQuizQuestions]   = useState<QuizQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex]   = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered]         = useState(false);
  const [quizScore, setQuizScore]           = useState(0);
  const [timeLeft, setTimeLeft]             = useState(30);
  const [answers, setAnswers]               = useState<{ selected: number | null; correct: boolean }[]>([]);

  const openModal = (tip: Tip) => {
    setSelectedTip(tip);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedTip(null);
    setIsModalOpen(false);
  };


useEffect(() => {
  const fetchFeatureFlags = async () => {
    try {
      const response = await fetch('/api/feature-flags/read');
      const data = await response.json();
      setFeatureFlags(data);
    } catch (error) {
      console.error('Error fetching feature flags:', error);
    }
  };

  fetchFeatureFlags();
}, []);

useEffect(() => {
  const fetchArticles = async () => {
    setArticlesLoading(true);
    try {
      // rss2json converts any RSS feed to JSON with CORS support
      const feed = encodeURIComponent('https://feeds.feedburner.com/TheHackersNews');
      const res  = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${feed}&count=10`
      );
      const data = await res.json();
      if (data.status === 'ok' && data.items?.length) {
        const articles: MediumArticle[] = data.items.map((item: any) => ({
          title:       item.title,
          link:        item.link,
          date:        new Date(item.pubDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          description: item.description
            ?.replace(/<[^>]+>/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim()
            .slice(0, 150) + '…',
          thumbnail: item.thumbnail || item.enclosure?.link || undefined,
        }));
        setMediumArticles(articles);
      }
    } catch (_) {
      // silently keep mockMediumArticles as fallback
    } finally {
      setArticlesLoading(false);
    }
  };
  fetchArticles();
}, []);


  const token = localStorage.getItem('token');
  useEffect(() => {



    let isMounted = true; // prevent state updates after unmount

    // Interval for rotating attacks
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % mockRecentAttacks.length);
    }, 4000);

    // Fetch profile image safely
    const fetchProfileImage = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch(`${API_BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          console.error("Failed to fetch profile:", res.status, res.statusText);
          return;
        }

        const data = await res.json();
        if (isMounted && data?.profileImage) {
          setProfileImage(data.profileImage); // ✅ update state safely
        }
      } catch (err) {
        console.error("Error fetching profile image:", err);
      }
    };

    fetchProfileImage();

    return () => {
      clearInterval(interval);
      isMounted = false;
    };
  }, []); // no token dependency needed, read it directly inside effect



  const handleLogout = async () => {
    try {
      // Call backend to clear cookies (if using httpOnly or session cookies)
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // important to include cookies
      });
    } catch (err) {
      console.error('Failed to call logout endpoint', err);
    } finally {
      // Remove token from localStorage
      localStorage.removeItem('token');
      // Redirect to login
      navigate('/login');
    }
  };

  const startQuiz = async () => {
    setQuizPhase('quiz');
    setCurrentQIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setQuizScore(0);
    setTimeLeft(30);
    setAnswers([]);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/quiz-questions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data: QuizQuestion[] = await res.json();
      setQuizQuestions(data);
    } catch {
      setQuizPhase('intro');
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (isAnswered) return;
    const correct = optionIndex === quizQuestions[currentQIndex].correctIndex;
    setSelectedOption(optionIndex);
    setIsAnswered(true);
    if (correct) setQuizScore(prev => prev + 1);
    setAnswers(prev => [...prev, { selected: optionIndex, correct }]);
  };

  const handleNext = useCallback(() => {
    if (currentQIndex + 1 >= quizQuestions.length) {
      setQuizPhase('result');
    } else {
      setCurrentQIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setTimeLeft(30);
    }
  }, [currentQIndex, quizQuestions.length]);

  // Countdown timer
  useEffect(() => {
    if (quizPhase !== 'quiz' || isAnswered) return;
    if (timeLeft === 0) {
      setIsAnswered(true);
      setAnswers(prev => [...prev, { selected: null, correct: false }]);
      return;
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [quizPhase, isAnswered, timeLeft]);

  // Auto-advance 4 seconds after answering
  useEffect(() => {
    if (!isAnswered || quizPhase !== 'quiz') return;
    const t = setTimeout(handleNext, 4000);
    return () => clearTimeout(t);
  }, [isAnswered, handleNext, quizPhase]);

  return (
<div className="min-h-screen flex flex-col 
  bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
  dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-700
  text-gray-900 dark:text-gray-100">
      <title> Security Awareness </title>
      <Header
        token={localStorage.getItem("token") || ""}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />



      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />


        <div className="mt-6 ml-6 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 rounded-lg shadow-md hover:scale-105 transition-transform duration-200"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        </div>


        <main className="flex-grow px-6 py-6 max-w-6xl mx-auto">
          {/* Page Header */}
          <header className="text-center mb-12">
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-amber-400 drop-shadow-md">
              Stay Safe Online
            </h1>
            <p className="text-gray-600 mt-2 text-lg">
              Simple steps to protect your digital life
            </p>
          </header>

          {/* Cyber Awareness Quiz */}
          <section id="quiz-section" className="mb-14 border-2 border-amber-500 rounded-2xl p-6 bg-white/80 shadow-md">
            {quizPhase === 'intro' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <BookOpen className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-amber-600 mb-1">Cyber Awareness Quiz</h2>
                <p className="text-gray-500 mb-6">Test your cybersecurity knowledge — India edition</p>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {['🎣 Phishing', '📱 Smishing', '📞 Vishing', '🎭 Social Eng.', '🚨 Digital Arrest', '💾 Ransomware'].map(b => (
                    <span key={b} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">{b}</span>
                  ))}
                </div>
                <p className="text-gray-500 text-sm mb-6">10 questions · 15 seconds each · 4 choices</p>
                <button
                  onClick={startQuiz}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-8 py-3 rounded-xl font-semibold text-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-md"
                >
                  Start Quiz →
                </button>
              </motion.div>
            )}

            {quizPhase === 'quiz' && quizQuestions.length > 0 && (
              <motion.div key={currentQIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-500 font-medium">Question {currentQIndex + 1} / {quizQuestions.length}</span>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{quizQuestions[currentQIndex].category}</span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className={`text-sm font-bold ${timeLeft > 20 ? 'text-green-600' : timeLeft > 10 ? 'text-amber-500' : 'text-red-500'}`}>{timeLeft}s</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${timeLeft > 20 ? 'bg-green-500' : timeLeft > 10 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${(timeLeft / 30) * 100}%` }}
                    />
                  </div>
                </div>

                <p className="text-xl font-semibold text-gray-800 mb-5">{quizQuestions[currentQIndex].question}</p>

                <div className="space-y-3 mb-5">
                  {quizQuestions[currentQIndex].options.map((option, idx) => {
                    const isCorrect = idx === quizQuestions[currentQIndex].correctIndex;
                    const isSelected = idx === selectedOption;
                    let cls = "w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium ";
                    if (!isAnswered) cls += "border-slate-300 bg-white text-gray-800 hover:border-amber-400 hover:bg-amber-50";
                    else if (isCorrect) cls += "border-green-500 bg-green-500 text-white";
                    else if (isSelected) cls += "border-red-500 bg-red-500 text-white";
                    else cls += "border-slate-200 bg-gray-50 text-gray-400";
                    return (
                      <button key={idx} onClick={() => handleAnswer(idx)} disabled={isAnswered} className={cls}>
                        <span className="mr-2 font-bold">{['A', 'B', 'C', 'D'][idx]}.</span>{option}
                        {isAnswered && isCorrect && <CheckCircle2 className="inline ml-2 w-4 h-4" />}
                        {isAnswered && isSelected && !isCorrect && <XCircle className="inline ml-2 w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {isAnswered && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                      <p className="text-sm font-medium text-amber-900 mb-1">
                        {selectedOption === quizQuestions[currentQIndex].correctIndex ? "Correct! 🎉" : timeLeft === 0 ? "Time's up! ⏰" : "Not quite! ❌"}
                      </p>
                      <p className="text-sm text-gray-700">{quizQuestions[currentQIndex].explanation}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isAnswered && (
                  <button onClick={handleNext} className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-2 rounded-xl font-semibold hover:from-amber-400 hover:to-amber-500 transition-all">
                    {currentQIndex + 1 >= quizQuestions.length ? 'See Results' : 'Next'} <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            )}

            {quizPhase === 'result' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <p className="text-6xl font-extrabold text-amber-500 mb-2">{quizScore} <span className="text-3xl text-gray-400">/ 10</span></p>
                {(() => {
                  const g = quizScore >= 9 ? { label: "Cyber Security Expert 🏆", color: "text-amber-600" }
                    : quizScore >= 7 ? { label: "Well Defended 🛡️", color: "text-green-600" }
                    : quizScore >= 5 ? { label: "Getting There 📚", color: "text-blue-600" }
                    : { label: "Keep Learning 🔰", color: "text-orange-500" };
                  return <p className={`text-xl font-bold mb-2 ${g.color}`}>{g.label}</p>;
                })()}
                <p className="text-gray-500 mb-6">
                  {quizScore >= 9 ? "Outstanding! You know how to stay safe online."
                    : quizScore >= 7 ? "Great work! A little more practice and you'll be an expert."
                    : quizScore >= 5 ? "Good effort — review the tips below to strengthen your knowledge."
                    : "Don't worry — cybersecurity is a journey. The tips below will help."}
                </p>
                {/* Per-question breakdown */}
                {answers.length > 0 && (
                  <div className="mt-8 text-left space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Question Breakdown</p>
                    {quizQuestions.map((q, idx) => {
                      const ans = answers[idx];
                      const timedOut = !ans || ans.selected === null;
                      const correct = ans?.correct;
                      return (
                        <div key={idx} className={`rounded-xl border p-3 ${correct ? 'border-green-200 bg-green-50' : timedOut ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                          <div className="flex items-start gap-2">
                            {correct
                              ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              : timedOut
                                ? <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                : <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-400 mb-1">Q{idx + 1} · {q.category}</p>
                              <p className="text-sm font-semibold text-gray-800 mb-2">{q.question}</p>
                              {!correct && !timedOut && ans.selected !== null && (
                                <p className="text-xs text-red-600 mb-1">Your answer: {q.options[ans.selected]}</p>
                              )}
                              {timedOut && (
                                <p className="text-xs text-amber-600 mb-1">Time's up — no answer given</p>
                              )}
                              <p className="text-xs text-green-700 font-medium">
                                {correct ? 'Correct: ' : 'Right answer: '}{q.options[q.correctIndex]}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 italic">{q.explanation}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 justify-center mt-6">
                  <button onClick={startQuiz} className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-amber-400 hover:to-amber-500 transition-all">
                    <RotateCcw className="w-4 h-4" /> Play Again
                  </button>
                  <button
                    onClick={() => document.getElementById('security-tips')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex items-center gap-2 border-2 border-amber-500 text-amber-600 px-6 py-3 rounded-xl font-semibold hover:bg-amber-50 transition-all"
                  >
                    Review Tips Below ↓
                  </button>
                </div>
              </motion.div>
            )}
          </section>

          {/* Security Tips */}
          <section id="security-tips" className="mb-14 border rounded-2xl p-6 bg-white/70 shadow-md">
            <h2 className="text-2xl font-semibold mb-6 text-amber-600">
              Steps to Stay Secure Online
            </h2>

            {/* Tip Cards */}
            <ul className="grid md:grid-cols-2 gap-5">
              {tips.map((tip, index) => (
                <li
                  key={index}
                  className="bg-white shadow-md hover:shadow-lg p-4 rounded-xl border-l-4 border-amber-500 hover:border-amber-400 
              transition-all duration-300 cursor-pointer hover:bg-gray-100"
                  onClick={() => openModal(tip)}
                >
                  <span className="font-medium text-gray-800">✅ {tip.title}</span>
                </li>
              ))}
            </ul>

            {/* Modal */}
            {isModalOpen && selectedTip && (
              <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
                <div className="bg-white rounded-2xl shadow-lg p-6 w-11/12 md:w-1/2 max-h-[80vh] overflow-auto relative animate-fadeIn">
                  <button
                    onClick={closeModal}
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
                  >
                    ✖
                  </button>

                  <h3 className="text-2xl font-semibold mb-4 text-amber-600">
                    {selectedTip.title}
                  </h3>

                  <div className="text-gray-700 whitespace-pre-line space-y-4">
                    {/* Description */}
                    <p>{selectedTip.description}</p>

                    {/* Importance */}
                    {selectedTip.importance && selectedTip.importance.length > 0 && (
                      <div>
                        <h4 className="font-semibold">Why it Matters:</h4>
                        <ul className="list-disc list-inside">
                          {selectedTip.importance.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Pro Tips */}
                    {selectedTip.proTips && selectedTip.proTips.length > 0 && (
                      <div>
                        <h4 className="font-semibold">Pro Tips:</h4>
                        <ul className="list-disc list-inside">
                          {selectedTip.proTips.map((tip, idx) => (
                            <li key={idx}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}


                    {selectedTip.bestPractices && selectedTip.bestPractices.length > 0 && (
                      <div>
                        <h4 className="font-semibold">Best Practices:</h4>
                        <ul className="list-disc list-inside">
                          {selectedTip.bestPractices.map((tip, idx) => (
                            <li key={idx}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* How To */}
                    {selectedTip.howTo && selectedTip.howTo.length > 0 && (
                      <div>
                        <h4 className="font-semibold">How To:</h4>
                        <ol className="list-decimal list-inside">
                          {selectedTip.howTo.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

{/* Signs */}
{selectedTip.signs && selectedTip.signs.length > 0 && (
  <div className="mt-4">
    <h4 className="font-semibold text-red-600">Signs:</h4>
    <ul className="list-disc list-inside">
      {selectedTip.signs.map((sign, idx) => (
        <li key={idx}>{sign}</li>
      ))}
    </ul>
  </div>
)}



                    {/* Quick Tip */}
                    {selectedTip.quickTip && (
                      <p className="italic font-medium">💡 Quick Tip: {selectedTip.quickTip}</p>
                    )}

                    {/* Real Life Example */}
                    {selectedTip.realLifeExample && (
                      <p className="mt-2 text-gray-800">📖 {selectedTip.realLifeExample}</p>
                    )}

                    {/* Tools */}
                    {selectedTip.tools && selectedTip.tools.length > 0 && (
                      <div>
                        <h4 className="font-semibold">Recommended Tools:</h4>
                        <ul className="list-disc list-inside">
                          {selectedTip.tools.map((tool, idx) => (
                            <li key={idx}>{tool}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recovery Steps */}
                    {selectedTip.recoverySteps && selectedTip.recoverySteps.length > 0 && (
                      <div>
                        <h4 className="font-semibold">Recovery Steps:</h4>
                        <ol className="list-decimal list-inside">
                          {selectedTip.recoverySteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

{/* References */}
{selectedTip.reference && selectedTip.reference.length > 0 && (
  <div className="mt-4">
    <h4 className="font-semibold text-blue-700">References:</h4>
    <ul className="list-disc list-inside">
      {selectedTip.reference.map((ref, idx) => (
        <li key={idx}>
          <a
            href={ref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {ref}
          </a>
        </li>
      ))}
    </ul>
  </div>
)}



                  </div>
                </div>
              </div>
            )}

          </section>



          {/* Account Breach Checker */}
          <section className="mb-14 border rounded-2xl p-6 bg-white/80 shadow-md text-center">
            <h2 className="text-2xl font-semibold mb-4 text-purple-700">
              Check if Your Account Has Been Breached
            </h2>
            <p className="mb-4 text-gray-700">
              Visit the official Have I Been Pwned website to see if your email or
              account has been involved in a data breach.
            </p>
            <button
              onClick={() =>
                window.open("https://www.haveibeenpwned.com/", "_blank")
              }
            className="bg-amber-500 text-slate-900 px-6 py-3 rounded hover:bg-amber-400 transition-colors"
            >
              Go to Have I Been Pwned
            </button>
          </section>

          {/* Recent Cyber Attacks */}
          <section className="mb-14 border rounded-2xl p-6 bg-gradient-to-r from-red-100 to-rose-200 shadow-md">
            <h2 className="text-2xl font-semibold mb-6 text-rose-700">
              Recent Cyber Attacks
            </h2>
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-white/80 p-6 rounded-xl shadow-md"
            >
              <h3 className="text-lg font-bold text-red-900 mb-1">
                {mockRecentAttacks[current].title}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                {mockRecentAttacks[current].date}
              </p>
              <p className="mb-3">{mockRecentAttacks[current].description}</p>
              <a
                href={mockRecentAttacks[current].link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 font-medium hover:text-amber-500 hover:underline"
              >
                🔗 Read more →
              </a>
            </motion.div>
          </section>

          {/* Latest Security Articles */}
          <section className="border rounded-2xl p-6 bg-white/70 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-green-700">
                Latest Cybersecurity Articles
              </h2>
              {articlesLoading && (
                <span className="text-xs text-gray-400 animate-pulse">Fetching latest…</span>
              )}
            </div>
            <div className="overflow-hidden">
              <motion.div
                className="flex gap-6"
                animate={{ x: ["0%", "-100%"] }}
                transition={{ ease: "linear", duration: 30, repeat: Infinity }}
              >
                {mediumArticles.concat(mediumArticles).map((article, index) => (
                  <div
                    key={index}
                    className="min-w-[320px] bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
                  >
                    {article.thumbnail && (
                      <img
                        src={article.thumbnail}
                        alt=""
                        className="w-full h-36 object-cover"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-bold text-base text-green-800 leading-snug line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">{article.date}</p>
                      <p className="mt-2 text-sm text-gray-600 line-clamp-3 flex-1">{article.description}</p>
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-3 text-amber-600 hover:text-amber-500 hover:underline font-medium text-sm"
                      >
                        Read full article →
                      </a>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
            <p className="text-gray-500 text-sm mt-3 text-center">
              📰 Live feed · auto-scrolls continuously
            </p>
          </section>
        </main>

        {/* Add fixed SecurityChatbotIcon */}
        {featureFlags.securityChatbotEnabled && (
  <div
    className="fixed bottom-8 right-8 z-50 cursor-pointer"
    onClick={() => setIsOpen(!isOpen)}
  >
    <SecurityChatbotIcon />
  </div>
)}

        {/* Chat Window */}
        {/* {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-8 right-8 z-50 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition"
          >
            Chat with Nick 💬
          </button>
        )} */}

        {/* Chat Window */}
        {isOpen && (
          <div
            className={`fixed z-50 bg-white rounded-xl shadow-xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out
      ${isFullScreen
                ? "inset-0 w-full h-full m-0 rounded-none" // Fullscreen mode
                : "bottom-20 right-4 sm:right-8 sm:bottom-24 w-[90vw] h-[75vh] sm:w-96 sm:h-[500px]" // Responsive size
              }`}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-3 bg-blue-600 text-white">
              <span className="font-semibold text-sm sm:text-base">Chat with Nick</span>
              <div className="flex space-x-3">
                {/* Fullscreen Toggle */}
                <button
                  onClick={() => setIsFullScreen((prev) => !prev)}
                  className="text-lg font-bold hover:text-gray-200 transition"
                  title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullScreen ? "🗕" : "🗖"}
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-lg font-bold hover:text-gray-200 transition"
                  title="Close Chat"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-hidden">
              <BotChat />
            </div>
          </div>
        )}


      </div>
      <Footer />
    </div>
  );
};
