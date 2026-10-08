import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-3.8-flash", 
  generationConfig: { responseMimeType: "application/json" } 
});

const personas = [
  {
    id: "Uncle_Shimon_68",
    description: "You are Uncle Shimon, 68 years old. You are slightly technophobic. You read things slowly and literally. You want to RSVP 'Yes' for yourself and your wife (2 adults total, no kids). You will click 'Let's start', enter your name 'שמעון ורבקה', choose 'Yes' (נגיע בשמחה), choose 'Both' (מגיעים להכל). When asked for guest counts, you make sure adults is 2. Then you write a simple blessing 'מזל טוב מכל הלב'. You do NOT use AI tools. You just submit."
  },
  {
    id: "Cousin_Noa_22",
    description: "You are Cousin Noa, 22 years old. You are fast and love tech. You are coming alone to the party only (1 adult, 0 kids). You enter name 'נועה'. You choose 'Yes', then 'רק למסיבה'. Adults = 1. You love AI, so you type a basic blessing 'מזל טוב תובל' and then MUST click the AI upgrade button ('שדרוג הברכה'). Then you submit."
  }
];

async function runAgent(persona) {
  console.log(`\n🤖 [START] Persona: ${persona.id}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 12 Pro size
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173');
  } catch(e) {
    console.error("Could not reach localhost:5173", e);
    await browser.close();
    return;
  }

  let stepCount = 0;
  const maxSteps = 15;
  
  while (stepCount < maxSteps) {
    await page.waitForTimeout(2000); // Wait for React state & animations to settle
    
    const elements = await page.evaluate(() => {
      // Find all interactable elements
      const interactables = Array.from(document.querySelectorAll('button, input, textarea, div[role="button"]'));
      return interactables.map((el, index) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).opacity !== '0';
        if (!isVisible) return null;
        
        el.setAttribute('data-agent-id', index.toString());
        return {
          id: index,
          tag: el.tagName.toLowerCase(),
          text: el.innerText || el.value || el.placeholder || (el.labels && el.labels[0] ? el.labels[0].innerText : ''),
          type: el.type || undefined,
        };
      }).filter(e => e !== null && (e.text || '').trim() !== '');
    });

    const pageText = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' ').substring(0, 1000));

    const prompt = `
    Persona Description: ${persona.description}
    
    You are an autonomous testing agent acting as this persona interacting with a mobile web app. 
    Current visible text on page: "${pageText}"
    
    Interactive elements available:
    ${JSON.stringify(elements, null, 2)}
    
    Decide your NEXT action based on your persona's goals and the current UI state.
    If you see a final success message like "איזה כיף שאתם באים", your task is "done".
    If your persona is supposed to use an AI upgrade button, make sure you actually click it when it appears.
    
    Respond ONLY with a valid JSON object matching exactly this schema:
    {
      "thought": "Explain your reasoning as this persona",
      "action": "click" | "type" | "done",
      "elementId": <number id of the element to interact with, ONLY if action is click or type>,
      "value": "<text to type, ONLY if action is type>"
    }
    `;

    try {
      const result = await model.generateContent(prompt);
      let responseText = result.response.text();
      // Clean up markdown block if present
      if (responseText.startsWith('\`\`\`')) {
         responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      }
      
      const response = JSON.parse(responseText);
      console.log(`🤔 [${persona.id}]: ${response.thought}`);
      
      if (response.action === 'done') {
        console.log(`✅ [${persona.id}]: Goal achieved! Finished flow.`);
        break;
      }
      
      if (response.action === 'click' && response.elementId !== undefined) {
         console.log(`👉 Clicking element ID: ${response.elementId}`);
         await page.click(`[data-agent-id="${response.elementId}"]`, { timeout: 2000 });
      } else if (response.action === 'type' && response.elementId !== undefined) {
         console.log(`⌨️ Typing "${response.value}" into element ID: ${response.elementId}`);
         await page.fill(`[data-agent-id="${response.elementId}"]`, response.value, { timeout: 2000 });
      } else {
         console.log(`⚠️ Agent sent an unknown action or missing elementId: ${response.action}`);
      }
    } catch (e) {
      console.log(`❌ Error parsing LLM response or interacting: ${e.message}`);
      // Break on error
      break;
    }
    stepCount++;
  }
  
  await browser.close();
}

async function main() {
  console.log("🚀 Starting Agentic QA Suite...");
  for (const p of personas) {
     await runAgent(p);
  }
  console.log("🏁 QA Suite Finished.");
}
main();
