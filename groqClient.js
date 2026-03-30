const axios = require("axios");

const GROQ_API_KEY  = "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";
const GROQ_API_URL  = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL    = "meta-llama/llama-4-scout-17b-16e-instruct";

/**
 * Calls Groq API and returns parsed JSON for 15-slide PPT content.
 */
async function generatePPTContent({ title, description, technologies, demoVideo }, apiKey = null) {
  const techList = technologies || "Not specified";
  const demoNote = demoVideo ? `A demo video is available at: ${demoVideo}` : "No demo video provided.";

  const systemPrompt = `You are an expert academic project presentation designer.
Your task is to generate complete, detailed content for a 15-slide college project presentation in strict JSON format.
Every slide must have rich, relevant content. Do NOT use generic placeholders — use the actual project details provided.
Return ONLY valid JSON with no markdown, no code blocks, no explanation.`;

  const userPrompt = `Generate a 15-slide project presentation for the following project:

PROJECT TITLE: ${title}
PROJECT DESCRIPTION: ${description}
TECHNOLOGIES USED: ${techList}
${demoNote}

Return a JSON object with this exact structure:
{
  "presentation": {
    "title": "...",
    "subtitle": "...",
    "techBadges": ["tech1", "tech2", ...],
    "slides": [
      {
        "slideNumber": 1,
        "type": "title",
        "title": "...",
        "subtitle": "...",
        "tagline": "...",
        "studentInfo": "Presented by: [Your Name]  |  Roll No: [Roll No]\\nUnder the Guidance of: [Guide Name]\\n[College Name]  |  [Academic Year]"
      },
      {
        "slideNumber": 2,
        "type": "abstract",
        "title": "Abstract",
        "content": "4-5 sentence abstract paragraph about the project...",
        "stats": [
          { "num": "...", "label": "..." },
          { "num": "...", "label": "..." },
          { "num": "...", "label": "..." },
          { "num": "...", "label": "..." }
        ]
      },
      {
        "slideNumber": 3,
        "type": "introduction",
        "title": "Introduction",
        "problemStatement": {
          "heading": "Problem Statement",
          "points": ["point 1", "point 2", "point 3", "point 4"]
        },
        "objectives": {
          "heading": "Objectives",
          "points": ["objective 1", "objective 2", "objective 3", "objective 4"]
        },
        "scope": "Brief scope statement about the project..."
      },
      {
        "slideNumber": 4,
        "type": "literature",
        "title": "Literature Survey",
        "papers": [
          { "author": "Author et al. (Year)", "title": "Paper Title", "finding": "Key finding in 1-2 sentences.", "gap": "Limitation in short phrase" },
          { "author": "Author et al. (Year)", "title": "Paper Title", "finding": "Key finding in 1-2 sentences.", "gap": "Limitation in short phrase" },
          { "author": "Author et al. (Year)", "title": "Paper Title", "finding": "Key finding in 1-2 sentences.", "gap": "Limitation in short phrase" },
          { "author": "Author et al. (Year)", "title": "Paper Title", "finding": "Key finding in 1-2 sentences.", "gap": "Limitation in short phrase" }
        ],
        "researchGap": "Overall research gap statement in 1-2 sentences."
      },
      {
        "slideNumber": 5,
        "type": "proposed",
        "title": "Proposed System",
        "subtitle": "Brief one-liner about the system",
        "features": [
          { "title": "Feature 1", "desc": "2-3 sentence description" },
          { "title": "Feature 2", "desc": "2-3 sentence description" },
          { "title": "Feature 3", "desc": "2-3 sentence description" },
          { "title": "Feature 4", "desc": "2-3 sentence description" }
        ]
      },
      {
        "slideNumber": 6,
        "type": "requirements",
        "title": "System Requirements",
        "hardware": ["Hardware req 1", "Hardware req 2", "Hardware req 3", "Hardware req 4"],
        "software": ["Software req 1", "Software req 2", "Software req 3", "Software req 4"],
        "techStack": [
          { "name": "Tech1", "cat": "Category" },
          { "name": "Tech2", "cat": "Category" },
          { "name": "Tech3", "cat": "Category" },
          { "name": "Tech4", "cat": "Category" },
          { "name": "Tech5", "cat": "Category" },
          { "name": "Tech6", "cat": "Category" },
          { "name": "Tech7", "cat": "Category" },
          { "name": "Tech8", "cat": "Category" }
        ]
      },
      {
        "slideNumber": 7,
        "type": "architecture",
        "title": "System Architecture",
        "layers": [
          { "label": "Layer 1" },
          { "label": "Layer 2" },
          { "label": "Layer 3" },
          { "label": "Layer 4" },
          { "label": "Layer 5" },
          { "label": "Layer 6" }
        ],
        "detailBoxes": [
          { "title": "Component 1", "items": "Description of component 1 in 2-3 sentences." },
          { "title": "Component 2", "items": "Description of component 2 in 2-3 sentences." },
          { "title": "Component 3", "items": "Description of component 3 in 2-3 sentences." }
        ]
      },
      {
        "slideNumber": 8,
        "type": "modules",
        "title": "System Modules",
        "modules": [
          { "name": "Module 1", "desc": "2-3 sentence description" },
          { "name": "Module 2", "desc": "2-3 sentence description" },
          { "name": "Module 3", "desc": "2-3 sentence description" },
          { "name": "Module 4", "desc": "2-3 sentence description" },
          { "name": "Module 5", "desc": "2-3 sentence description" },
          { "name": "Module 6", "desc": "2-3 sentence description" }
        ]
      },
      {
        "slideNumber": 9,
        "type": "technology",
        "title": "Core Technology & Models",
        "datasetOrCore": {
          "name": "Dataset/Core Component Name",
          "stats": "Key stats about dataset or core component"
        },
        "models": [
          { "name": "Approach 1", "acc": "XX%", "params": "XM", "pros": "Key advantage in 2 sentences.", "selected": true },
          { "name": "Approach 2", "acc": "XX%", "params": "XM", "pros": "Key advantage in 2 sentences.", "selected": false },
          { "name": "Approach 3", "acc": "XX%", "params": "XM", "pros": "Key advantage in 2 sentences.", "selected": false }
        ]
      },
      {
        "slideNumber": 10,
        "type": "screenshots",
        "title": "Implementation Screenshots",
        "screenshots": [
          "Screen 1 - Description",
          "Screen 2 - Description",
          "Screen 3 - Description",
          "Screen 4 - Description"
        ],
        "demoVideo": "${demoVideo || ""}"
      },
      {
        "slideNumber": 11,
        "type": "testing",
        "title": "Testing & Validation",
        "strategies": [
          { "name": "Strategy 1", "desc": "Short description" },
          { "name": "Strategy 2", "desc": "Short description" },
          { "name": "Strategy 3", "desc": "Short description" },
          { "name": "Strategy 4", "desc": "Short description" }
        ],
        "testCases": [
          { "id": "TC-01", "case": "Test case description", "expected": "Expected result", "status": "Pass" },
          { "id": "TC-02", "case": "Test case description", "expected": "Expected result", "status": "Pass" },
          { "id": "TC-03", "case": "Test case description", "expected": "Expected result", "status": "Pass" },
          { "id": "TC-04", "case": "Test case description", "expected": "Expected result", "status": "Pass" },
          { "id": "TC-05", "case": "Test case description", "expected": "Expected result", "status": "Pass" },
          { "id": "TC-06", "case": "Test case description", "expected": "Expected result", "status": "Pass" },
          { "id": "TC-07", "case": "Test case description", "expected": "Expected result", "status": "Pass" }
        ]
      },
      {
        "slideNumber": 12,
        "type": "results",
        "title": "Results & Performance",
        "chartData": {
          "labels": ["Metric1", "Metric2", "Metric3", "Metric4"],
          "values": [XX, XX, XX, XX]
        },
        "metrics": [
          { "label": "Precision", "value": "XX%" },
          { "label": "Recall", "value": "XX%" },
          { "label": "F1-Score", "value": "XX%" },
          { "label": "Speed", "value": "XXs" }
        ],
        "keyFindings": "2-3 sentence summary of key results and achievements."
      },
      {
        "slideNumber": 13,
        "type": "conclusion",
        "title": "Conclusion & Future Scope",
        "achievements": ["Achievement 1", "Achievement 2", "Achievement 3", "Achievement 4", "Achievement 5"],
        "futureScope": ["Future work 1", "Future work 2", "Future work 3", "Future work 4", "Future work 5"]
      },
      {
        "slideNumber": 14,
        "type": "references",
        "title": "References",
        "refs": [
          "[1] Author(s), \\"Paper Title,\\" in Journal/Conference, Year, pp. xx-xx.",
          "[2] Author(s), \\"Paper Title,\\" in Journal/Conference, Year, pp. xx-xx.",
          "[3] Author(s), \\"Paper Title,\\" in Journal/Conference, Year, pp. xx-xx.",
          "[4] Author(s), \\"Paper Title,\\" in Journal/Conference, Year, pp. xx-xx.",
          "[5] Author(s), \\"Paper Title,\\" in Journal/Conference, Year, pp. xx-xx.",
          "[6] Author(s), \\"Paper Title,\\" in Journal/Conference, Year, pp. xx-xx.",
          "[7] Author(s), \\"Paper Title,\\" in Journal/Conference, Year, pp. xx-xx."
        ]
      },
      {
        "slideNumber": 15,
        "type": "thankyou",
        "title": "Thank You!",
        "projectTitle": "...",
        "closingLine": "One memorable closing sentence about the project."
      }
    ]
  }
}

Make ALL content specific to the project provided. Use realistic numbers, relevant technology names, and domain-specific language.`;

  const response = await axios.post(
    GROQ_API_URL,
    {
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" }
    },
    {
      headers: {
        "Authorization": `Bearer ${apiKey || GROQ_API_KEY}`,
        "Content-Type":  "application/json"
      },
      timeout: 120000
    }
  );

  const raw = response.data.choices[0].message.content;
  return JSON.parse(raw);
}

module.exports = { generatePPTContent };
