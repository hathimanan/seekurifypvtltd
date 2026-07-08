import express from "express";
import cors from "cors";

const phishingServerRouter = express();

phishingServerRouter.use(express.json());


phishingServerRouter.post("/phishing", (req, res) => {
  const { url } = req.body;

  let risk = 0;
  const suspiciousWords = ["login", "verify", "secure", "update", "free"];
  suspiciousWords.forEach(word => {
    if (url.toLowerCase().includes(word)) risk += 20;
  });

  let level = "LOW";
  if (risk >= 60) level = "HIGH";
  else if (risk >= 40) level = "MEDIUM";

  res.json({
    risk,
    level,
    safe: risk < 50
  });
});



export default phishingServerRouter;