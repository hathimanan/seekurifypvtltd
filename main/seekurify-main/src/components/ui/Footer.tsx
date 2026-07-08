import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="bg-gradient-to-b from-gray-800 to-gray-900 text-gray-300 py-6">
  <div className="flex flex-col md:flex-row justify-between items-center px-6 lg:px-12">
    <p>© {new Date().getFullYear()} Seekurify. All rights reserved.</p>
    <div className="flex space-x-4 mt-2 md:mt-0">
      <Link to="/privacy-policy" className="hover:text-amber-400">
        Privacy Policy
      </Link>
      <Link to="/terms-and-conditions" className="hover:text-amber-400">
        Terms & Conditions
      </Link>
      <Link to="/contact" className="hover:text-amber-400">
        Contact
      </Link>
    </div>
  </div>
</footer>
  );
};

export default Footer;
