# DeepSeek API 配置指南

## 配置步骤

1. **获取DeepSeek API密钥**
   - 访问 [DeepSeek平台](https://platform.deepseek.com/)
   - 注册账号并登录
   - 在API密钥管理页面创建新的API密钥

2. **配置环境变量**
   - 复制 `.env.example` 文件为 `.env`
   - 在 `.env` 文件中添加你的API密钥：
     ```
     VITE_DEEPSEEK_API_KEY=your_actual_api_key_here
     ```

3. **使用DeepSeek模型**
   - 启动应用后，在AI聊天界面底部的模型选择器中
   - 选择 "DeepSeek Chat" 或 "DeepSeek Coder"
   - 开始与DeepSeek模型对话

## 模型说明

- **DeepSeek Chat**: 通用对话模型，适合日常问答和对话
- **DeepSeek Coder**: 代码专用模型，更适合编程相关问题

## 故障排除

如果API调用失败，请检查：
1. API密钥是否正确配置
2. 网络连接是否正常
3. API密钥是否有效且未过期
4. 是否达到了API调用频率限制

## 注意事项

- 请妥善保管你的API密钥，不要提交到代码仓库
- 建议设置适当的API调用频率限制，避免过度使用
- 如遇到问题，可以查看控制台中的错误日志