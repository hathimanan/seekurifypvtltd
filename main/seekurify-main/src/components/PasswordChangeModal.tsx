import React from 'react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const PasswordChangeModal: React.FC = () => {
  const navigate = useNavigate();

  const handleContinue = () => {
    navigate('/change-password', { replace: true });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-bold mb-4">
          Password Update Required
        </h2>

        <p className="text-sm text-gray-600 mb-6">
          For your account’s security, your password needs to be updated before you can continue.
          This may be due to multiple unsuccessful login attempts within a short time or because
          your password has not been changed recently.
        </p>

        <Button className="w-full" onClick={handleContinue}>
          Update Password
        </Button>
      </div>
    </div>
  );
};

export default PasswordChangeModal;
