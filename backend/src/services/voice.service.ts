import { config } from "../config";

interface ExtractedFields {
  [key: string]: string;
}

const FIELD_PROMPTS: Record<string, string> = {
  lost: `Extract these fields from the spoken text about a MISSING person report:
- reporter_name: the name of the person reporting
- reporter_phone: phone number (Indian format +91XXXXXXXXXX)
- person_name: name of the missing person
- person_age: age of the missing person (number only)
- person_gender: gender (male, female, or other)
- person_height: height in cm (number only)
- person_clothing: description of what they were wearing
- person_physical_features: birthmarks, glasses, scars, etc.
- last_seen_location: where they were last seen`,

  searching: `Extract these fields from the spoken text about SEARCHING for someone:
- reporter_name: the name of the person reporting
- reporter_phone: phone number (Indian format +91XXXXXXXXXX)
- person_name: name of the person being searched
- person_age: age (number only)
- person_gender: gender (male, female, or other)
- person_height: height in cm (number only)
- person_clothing: description of what they were wearing
- person_physical_features: birthmarks, glasses, scars, etc.
- last_seen_location: where they were last seen`,

  found: `Extract these fields from the spoken text about a FOUND person:
- reporter_name: the name of the person reporting
- reporter_phone: phone number (Indian format +91XXXXXXXXXX)
- found_person_description: full description of the found person (age, gender, clothing, condition, language spoken)`,
};

class VoiceService {
  async parseTranscript(
    transcript: string,
    caseType: string,
  ): Promise<ExtractedFields> {
    const apiKey = config.claude.apiKey;
    if (!apiKey) {
      throw new Error("Claude API key not configured");
    }

    const fieldPrompt =
      FIELD_PROMPTS[caseType] || FIELD_PROMPTS["lost"];

    const systemPrompt = `You are a form field extractor for a missing person system at Kumbh Mela. 
Extract structured data from spoken text transcripts. The user may speak in English, Hindi, or Hinglish (mixed).
Return ONLY a valid JSON object with the extracted fields. 
If a field cannot be determined from the text, omit it from the JSON.
For phone numbers, format as +91XXXXXXXXXX.
For age and height, return only the number as a string.
For gender, normalize to: male, female, or other.
Do not include any explanation — only the JSON object.`;

    const userPrompt = `${fieldPrompt}

Spoken transcript: "${transcript}"

Return only the JSON object with extracted fields:`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.claude.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Claude API error:", response.status, errBody);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "{}";

    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response:", content);
      return {};
    }

    try {
      const fields: ExtractedFields = JSON.parse(jsonMatch[0]);
      // Sanitize: only return known fields
      const allowedFields = [
        "reporter_name",
        "reporter_phone",
        "person_name",
        "person_age",
        "person_gender",
        "person_height",
        "person_clothing",
        "person_physical_features",
        "last_seen_location",
        "found_person_description",
      ];
      const sanitized: ExtractedFields = {};
      for (const key of allowedFields) {
        if (fields[key] !== undefined && fields[key] !== null) {
          sanitized[key] = String(fields[key]).trim();
        }
      }
      return sanitized;
    } catch (parseErr) {
      console.error("Failed to parse Claude JSON response:", content);
      return {};
    }
  }
}

export default new VoiceService();
