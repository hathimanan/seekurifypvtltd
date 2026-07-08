// import React, { useState } from 'react';
// import { Button } from './ui/button';
// import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
// import { app } from '../firebaseConfig';
// import { API_BASE_URL } from '../services/api';
// import { useNavigate } from 'react-router-dom';
// import { ErrorModal } from './ui/ErrorModal';

// interface GoogleSignInButtonProps {
//   onSuccess: () => void; // callback from parent to handle redirect
// }

// const handleGoogleLogin = async () => {
//   const auth = getAuth(app);
//   const provider = new GoogleAuthProvider();
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);
//   const navigate = useNavigate();
//   const { onSuccess } = GoogleSignInButtonProps;

//   try {
//     const result = await signInWithPopup(auth, provider);
//     const user = result.user;

//     // Get Firebase ID token
//     const googleToken = await user.getIdToken();

//     // Check if email exists in backend
//     const response = await fetch(`${API_BASE_URL}/auth/check-user`, {
//       method: 'POST',
//       headers: { 
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${googleToken}`
//       },
//       body: JSON.stringify({ email: user.email }),
//     });

//     const data = await response.json();

//     if (response.ok && data.exists) {
//       // Store the Firebase token
//       localStorage.setItem('googleToken', googleToken);
//       onSuccess();
//     } else {
//       localStorage.removeItem("googleToken");
//       setErrorMessage("No account found. Please sign up first.");
//     }

//   } catch (error) {
//     console.error("Google Sign-in error:", error);
//     localStorage.removeItem("googleToken");
//     setErrorMessage("Google Sign-in failed. Please try again.");
//   }
// };


//   return (
//  <>
//   <Button
//     type="button"
//     onClick={handleGoogleLogin}
//     className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 px-4 rounded-md font-medium flex items-center justify-center space-x-2"
//   >
//     <span>Sign In with Google</span>
//     <span className="text-xl">G</span>
//   </Button>

//   {/* Error Modal */}
//   {errorMessage && (
//     <ErrorModal
//       message={errorMessage}
//       onClose={() => {
//         setErrorMessage(null);
//         navigate("/login"); // redirect back to login after closing modal
//       }}
//     />
//   )}
// </>
//   );
// }


