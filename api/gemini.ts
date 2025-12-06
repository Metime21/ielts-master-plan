// api/gemini.ts

// ... (省略导入和初始化代码)

    try {
        const { contents } = req.body;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
        });

        res.status(200).json(response);
    } catch (error) {
        // 🚨 关键修改：强制打印错误对象的完整JSON结构
        console.error('Gemini API Call Error:', JSON.stringify(error, null, 2));
        
        // 检查是否有详细的 API 错误信息
        let errorMessage = 'Internal Server Error during API call.';
        if (error && typeof error === 'object' && 'message' in error) {
            errorMessage = error.message;
        }

        // 返回 500 状态码，因为这本质上是服务器错误
        res.status(500).json({ error: errorMessage });
    }
};