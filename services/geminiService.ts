// services/geminiservices.ts

const fetchGeminiProxy = async (contents: any, config?: any): Promise<any> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contents, config }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Proxy failed: ${errorData.error}`);
  }

  return await response.json();
};
