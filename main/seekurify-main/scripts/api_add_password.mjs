import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const token = jwt.sign({_id: '68df973d4b94966c255eb567', email: 'test@example.com'}, process.env.JWT_SECRET || 'defaultsecret');

(async ()=>{
  const res = await fetch('http://localhost:5000/api/passwords', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ website: 'API-Added', username: 'apiuser', password: 'ApiP@ss1234' })
  });
  const text = await res.text();
  console.log('Status', res.status, text);
})();