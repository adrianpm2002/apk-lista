/**
 * Claude AI Service
 * 
 * Service for integrating with Claude Sonnet 4 API
 */

import Constants from 'expo-constants';
import { AI_CONFIG } from '../config/aiConfig';

class ClaudeService {
  constructor() {
    this.config = AI_CONFIG.claude;
    this.apiKey = this.getApiKey();
  }

  getApiKey() {
    // In Expo, environment variables are accessed through Constants
    const apiKey = Constants.expoConfig?.extra?.anthropicApiKey || 
                   Constants.manifest?.extra?.anthropicApiKey ||
                   process.env?.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY not found in environment variables');
      console.log('Please configure your API key in app.config.js or .env file');
    }
    
    return apiKey;
  }

  async generateText(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('Claude API key not configured');
    }

    const requestBody = {
      model: this.config.model,
      max_tokens: options.maxTokens || this.config.maxTokens,
      temperature: options.temperature || this.config.temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.config.apiVersion,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return {
        content: data.content[0]?.text || '',
        usage: data.usage,
        model: data.model,
      };
    } catch (error) {
      console.error('Claude API request failed:', error);
      throw error;
    }
  }

  async analyzeData(data, analysisType = 'general') {
    const prompt = `Analiza los siguientes datos de lotería y proporciona insights útiles:

Tipo de análisis: ${analysisType}
Datos: ${JSON.stringify(data, null, 2)}

Por favor, proporciona un análisis en español que incluya:
1. Patrones identificados
2. Tendencias importantes
3. Recomendaciones
4. Resumen ejecutivo

Responde en formato JSON con las siguientes claves: patterns, trends, recommendations, summary`;

    return await this.generateText(prompt);
  }

  async generateReport(reportData) {
    const prompt = `Genera un reporte detallado basado en los siguientes datos de lotería:

${JSON.stringify(reportData, null, 2)}

El reporte debe incluir:
1. Resumen ejecutivo
2. Métricas principales
3. Análisis de tendencias
4. Recomendaciones estratégicas

Responde en español, en formato markdown bien estructurado.`;

    return await this.generateText(prompt);
  }

  async chatAssistant(userMessage, context = {}) {
    const systemPrompt = `Eres un asistente especializado en sistemas de lotería y gestión de apuestas. 
Ayudas a usuarios a entender estadísticas, generar reportes y optimizar operaciones.

Contexto de la aplicación:
- Es un sistema de gestión de loterías
- Los usuarios pueden ser administradores, recolectores o listeros
- Se manejan diferentes tipos de juegos: fijo, corrido, posición, parle, centena, tripleta

Responde siempre en español y de manera profesional.`;

    const prompt = `${systemPrompt}

Contexto actual: ${JSON.stringify(context)}

Usuario: ${userMessage}

Asistente:`;

    return await this.generateText(prompt, { maxTokens: 2048 });
  }
}

export const claudeService = new ClaudeService();
export default ClaudeService;