// chatWithDeepSeek.js - DeepSeek v3 integration via OpenRouter
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Set up OpenAI client with OpenRouter endpoint
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

/**
 * Sends a message to DeepSeek v3 via OpenRouter
 * @param {string} message - The user message
 * @param {string} model - The model to use (defaults to deepseek/deepseek-chat-v3-0324:free)
 * @returns {Promise<string>}
 */
export async function chatWithDeepSeek(message, model = 'deepseek/deepseek-chat-v3-0324:free', images = []) {
  try {
    const content = [];

    // Add text message
    content.push({ type: 'text', text: message });

    // Add images if provided
    for (const imageBase64 of images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: imageBase64 // Should be full data URI like "data:image/jpeg;base64,..."
        }
      });
    }

    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: content }],
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error('❌ Error with DeepSeek:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Sends a message to DeepSeek v3 (fast version without images)
 * @param {string} message - The user message
 * @param {string} model - The model to use
 * @returns {Promise<string>}
 */
export async function chatWithDeepSeekFast(message, model = 'deepseek/deepseek-chat-v3-0324:free') {
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: message }]
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error('❌ Error with DeepSeek:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Generate strategic dialog suggestions for meeting facilitation using DeepSeek
 * @param {string} transcript - Full meeting transcript text
 * @returns {Promise<string[]>} Array of 4 RPG-style dialog suggestions
 */
export async function generateDialogSuggestions(transcript) {
  try {
    // Read and populate the dialog suggestions prompt
    const dialogPromptTemplate = await import('fs').then(fs => fs.readFileSync('query_prompt_dialog_suggestions.md', 'utf-8'));
    const filledPrompt = dialogPromptTemplate.replace(/\{\{meeting_transcript\}\}/g, transcript);

    console.log('🗣️ Generating dialog suggestions from transcript using DeepSeek...');
    const response = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat-v3-0324:free',
      messages: [{ role: 'user', content: filledPrompt }],
    });

    // Parse the response into an array of strings (split by newlines, filter empty)
    const suggestions = response.choices[0].message.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('Response:') && !line.startsWith('Only return'));

    console.log(`✅ Generated ${suggestions.length} dialog suggestions with DeepSeek`);
    return suggestions.slice(0, 4); // Ensure max 4 suggestions
  } catch (err) {
    console.error('❌ Error generating dialog suggestions with DeepSeek:', err.message);
    return [
      "Continue exploring the key points raised so far",
      "Invite participants to share their perspectives",
      "Summarize the discussion and identify next priorities",
      "Seek consensus on the primary objectives"
    ]; // Fallback suggestions
  }
}

/**
 * Analyze sentiment from full meeting transcript for multiple users using DeepSeek
 * @param {string} transcript - Full meeting transcript text
 * @returns {Promise<Object>} Object with user keys and {positive, neutral, negative} values
 */
export async function analyzeSentiment(transcript) {
  try {
    // Read and populate the sentiment analysis prompt
    const sentimentPromptTemplate = await import('fs').then(fs => fs.readFileSync('query_prompt_sentiment_analysis.md', 'utf-8'));
    const filledPrompt = sentimentPromptTemplate.replace(/\{\{meeting_transcript\}\}/g, transcript);

    console.log('😊 Analyzing sentiment from full transcript using DeepSeek...');
    const response = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat-v3-0324:free',
      messages: [{ role: 'user', content: filledPrompt }],
    });

    // Parse the JSON response
    const rawContent = response.choices[0].message.content.trim();

    // Extract JSON from response (remove any markdown formatting if present)
    let jsonContent = rawContent;
    if (rawContent.startsWith('```json')) {
      jsonContent = rawContent.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (rawContent.startsWith('```')) {
      jsonContent = rawContent.replace(/```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const sentimentData = JSON.parse(jsonContent);
      console.log('✅ Sentiment analysis completed with DeepSeek:', Object.keys(sentimentData).length, 'users analyzed');
      return sentimentData;
    } catch (parseError) {
      console.error('❌ Error parsing sentiment JSON response from DeepSeek:', parseError.message);
      console.error('Raw response:', rawContent);
      // Return empty object as fallback
      return {};
    }
  } catch (err) {
    console.error('❌ Error analyzing sentiment with DeepSeek:', err.message);
    return {}; // Empty object as fallback
  }
}

/**
 * Generate a real-time meeting summary from transcript and images using DeepSeek
 * @param {string} transcript - Full current meeting transcript in VTT format
 * @param {string} meetingEvents - Meeting events log (if available)
 * @param {string[]} imageBase64Array - Array of base64 encoded screen share images
 * @param {string} streamId - Stream ID
 * @param {string} meetingUuid - Meeting UUID (for backward compatibility)
 * @returns {Promise<string>} Real-time meeting summary
 */
export async function generateRealTimeSummary(transcript, meetingEvents = '', imageBase64Array = [], streamId = '', meetingUuid = '') {
  try {
    // Read and populate the summary prompt
    const summaryPromptTemplate = await import('fs').then(fs => fs.readFileSync('summary_prompt.md', 'utf-8'));
    const todayDate = new Date().toISOString(); // Full ISO date with time

    const filledPrompt = summaryPromptTemplate
      .replace(/\{\{raw_transcript\}\}/g, transcript)
      .replace(/\{\{meeting_events\}\}/g, meetingEvents)
      .replace(/\{\{meeting_uuid\}\}/g, meetingUuid)
      .replace(/\{\{stream_id\}\}/g, streamId)
      .replace(/\{\{TODAYDATE\}\}/g, todayDate);

    console.log('📝 Generating real-time stream summary using DeepSeek...');
    const response = await chatWithDeepSeek(filledPrompt, 'deepseek/deepseek-chat-v3-0324:free', imageBase64Array);

    console.log('✅ Real-time summary generated with DeepSeek');
    return response;
  } catch (err) {
    console.error('❌ Error generating real-time stream summary with DeepSeek:', err.message);
    return 'Unable to generate summary at this time. Meeting in progress...';
  }
}

/**
 * Query the current meeting transcript for specific questions using DeepSeek
 * @param {string} transcript - Full current meeting transcript
 * @param {string} userQuery - User's question about the meeting
 * @returns {Promise<string>} Contextual answer based on transcript
 */
export async function queryCurrentMeeting(transcript, userQuery) {
  try {
    // Read and populate the current meeting query prompt
    const queryPromptTemplate = await import('fs').then(fs => fs.readFileSync('query_prompt_current_meeting.md', 'utf-8'));
    const filledPrompt = queryPromptTemplate
      .replace(/\{\{meeting_transcript\}\}/g, transcript)
      .replace(/\{\{user_query\}\}/g, userQuery);

    console.log('🔍 Querying current meeting transcript using DeepSeek...');
    const response = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat-v3-0324:free',
      messages: [{ role: 'user', content: filledPrompt }],
    });

    const answer = response.choices[0].message.content;
    console.log('✅ Meeting query answered with DeepSeek');
    return answer;
  } catch (err) {
    console.error('❌ Error querying current meeting with DeepSeek:', err.message);
    return 'I apologize, but I was unable to analyze the current meeting transcript. Please try again later.';
  }
}
