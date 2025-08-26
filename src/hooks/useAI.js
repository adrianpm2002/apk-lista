/**
 * AI Hook for React Components
 * 
 * Custom hook for using AI services in React components
 */

import { useState, useCallback } from 'react';
import { claudeService } from '../services/claudeService';

export const useAI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResponse, setLastResponse] = useState(null);

  const generateText = useCallback(async (prompt, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await claudeService.generateText(prompt, options);
      setLastResponse(response);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeData = useCallback(async (data, analysisType = 'general') => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await claudeService.analyzeData(data, analysisType);
      setLastResponse(response);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateReport = useCallback(async (reportData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await claudeService.generateReport(reportData);
      setLastResponse(response);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const chatAssistant = useCallback(async (message, context = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await claudeService.chatAssistant(message, context);
      setLastResponse(response);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    lastResponse,
    generateText,
    analyzeData,
    generateReport,
    chatAssistant,
    clearError,
  };
};