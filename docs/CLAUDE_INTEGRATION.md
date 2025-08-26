# Claude Sonnet 4 Integration

## Overview

This application now includes Claude Sonnet 4 AI integration to provide intelligent assistance for lottery data analysis and operations.

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

### API Key Setup

1. Sign up for an Anthropic account at https://console.anthropic.com
2. Generate an API key from your dashboard
3. Add the API key to your `.env` file
4. Ensure the `.env` file is added to `.gitignore` (already configured)

## Features

### AI Assistant

The AI Assistant is available to all user roles (admin, collector, listero) through the sidebar menu:

- **Chat Interface**: Interactive conversation with Claude Sonnet 4
- **Data Analysis**: Automated analysis of lottery statistics
- **Report Generation**: AI-powered report creation
- **Context-Aware**: Understands lottery system terminology and operations

### Available Functions

1. **Text Generation**: General text generation for reports and documentation
2. **Data Analysis**: Statistical analysis of lottery performance data
3. **Chat Assistant**: Interactive help and guidance
4. **Report Generation**: Automated creation of detailed reports

## Usage

### Accessing the AI Assistant

1. Open the sidebar menu (☰ button)
2. Select "🤖 Asistente IA Claude"
3. Start chatting with the AI assistant

### Example Interactions

- "Analiza mis estadísticas de la última semana"
- "Genera un reporte de rendimiento"
- "¿Cuáles son las mejores prácticas para gestionar números limitados?"
- "Explica las tendencias en mis ventas"

## Technical Details

### Model Configuration

- **Model**: Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)
- **Max Tokens**: 4096
- **Temperature**: 0.7
- **Provider**: Anthropic

### File Structure

```
src/
├── config/
│   └── aiConfig.js          # AI model configuration
├── services/
│   └── claudeService.js     # Claude API integration
├── hooks/
│   └── useAI.js            # React hook for AI functionality
├── components/
│   ├── AIAssistant.js      # Main AI chat interface
│   └── AIAssistantButton.js # Assistant button component
└── __tests__/
    └── aiIntegration.test.js # AI integration tests
```

### Security

- API keys are stored in environment variables
- Keys are not committed to version control
- API calls are made securely through HTTPS
- Error handling prevents key exposure

## Development

### Testing

Run the AI integration tests:

```bash
npm test -- __tests__/aiIntegration.test.js
```

### Local Development

1. Install dependencies: `npm install`
2. Configure environment variables
3. Start the development server: `npm start`

## Troubleshooting

### Common Issues

1. **API Key Error**: Ensure your ANTHROPIC_API_KEY is correctly set in `.env`
2. **Network Issues**: Check internet connection and firewall settings
3. **Rate Limits**: Anthropic has usage limits - check your account status

### Error Messages

- "Claude API key not configured" - Add API key to environment variables
- "Claude API error: 401" - Invalid API key
- "Claude API error: 429" - Rate limit exceeded

## Support

For AI-related issues:
1. Check the console for error messages
2. Verify API key configuration
3. Review network connectivity
4. Check Anthropic service status

## Future Enhancements

Planned features for future versions:
- Number prediction analysis (currently disabled)
- Advanced statistical modeling
- Batch data processing
- Custom model fine-tuning