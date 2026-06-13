/**
 * M-Pesa Payment Service
 * Handles M-Pesa integration for Safaricom mobile money (Kenya)
 */

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/payments.config');

class MPesaService {
  constructor() {
    this.config = config.mpesa;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Generate Base64 encoded authorization string
   */
  getAuthHeader() {
    const auth = `${this.config.consumerKey}:${this.config.consumerSecret}`;
    return Buffer.from(auth).toString('base64');
  }

  /**
   * Fetch OAuth token from Safaricom
   */
  async getAccessToken() {
    try {
      const endpoint = this.config.sandbox
        ? `${this.config.endpoint}/oauth/v1/generate?grant_type=client_credentials`
        : `${this.config.productionEndpoint}/oauth/v1/generate?grant_type=client_credentials`;

      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Basic ${this.getAuthHeader()}`,
        },
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      return this.accessToken;
    } catch (error) {
      console.error('M-Pesa OAuth Error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with M-Pesa');
    }
  }

  /**
   * Ensure access token is valid, refresh if needed
   */
  async ensureValidToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.getAccessToken();
    }
    return this.accessToken;
  }

  /**
   * Generate Timestamp and Password for STK Push
   */
  generatePassword() {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const data = `${this.config.businessShortCode}${this.config.passkey}${timestamp}`;
    const password = Buffer.from(data).toString('base64');
    return { password, timestamp };
  }

  /**
   * Initiate M-Pesa STK Push (prompt user for PIN)
   * @param {string} phoneNumber - Customer phone (format: 254XXXXXXXXX)
   * @param {number} amount - Amount in KES
   * @param {string} accountRef - Account reference/order ID
   * @param {string} description - Transaction description
   */
  async initiateSTKPush(phoneNumber, amount, accountRef, description) {
    try {
      const token = await this.ensureValidToken();
      const { password, timestamp } = this.generatePassword();

      const endpoint = this.config.sandbox
        ? `${this.config.endpoint}/stkpush/v1/processrequest`
        : `${this.config.productionEndpoint}/stkpush/v1/processrequest`;

      const payload = {
        BusinessShortCode: this.config.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phoneNumber,
        PartyB: this.config.businessShortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: this.config.callbackURL,
        AccountReference: accountRef,
        TransactionDesc: description,
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        success: true,
        checkoutRequestId: response.data.CheckoutRequestID,
        customerMessage: response.data.CustomerMessage,
        responseCode: response.data.ResponseCode,
      };
    } catch (error) {
      console.error('M-Pesa STK Push Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'STK Push failed',
      };
    }
  }

  /**
   * Query STK Push transaction status
   * @param {string} checkoutRequestId - Checkout request ID from STK Push
   */
  async querySTKPushStatus(checkoutRequestId) {
    try {
      const token = await this.ensureValidToken();
      const { password, timestamp } = this.generatePassword();

      const endpoint = this.config.sandbox
        ? `${this.config.endpoint}/stkpush/v1/query`
        : `${this.config.productionEndpoint}/stkpush/v1/query`;

      const payload = {
        BusinessShortCode: this.config.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        success: true,
        resultCode: response.data.ResultCode,
        resultDescription: response.data.ResultDesc,
        mpesaReceiptNumber: response.data.MpesaReceiptNumber,
      };
    } catch (error) {
      console.error('M-Pesa Query Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Query failed',
      };
    }
  }

  /**
   * Process callback from M-Pesa server
   * @param {object} callbackData - Callback data from M-Pesa
   */
  processCallback(callbackData) {
    const { Body } = callbackData;
    const result = Body?.stkCallback;

    if (!result) return null;

    return {
      checkoutRequestId: result.CheckoutRequestID,
      resultCode: result.ResultCode,
      resultDescription: result.ResultDesc,
      amount: result.CallbackMetadata?.Item?.[0]?.Value,
      mpesaReceiptNumber: result.CallbackMetadata?.Item?.[1]?.Value,
      transactionDate: result.CallbackMetadata?.Item?.[2]?.Value,
      phoneNumber: result.CallbackMetadata?.Item?.[3]?.Value,
      success: result.ResultCode === 0,
    };
  }
}

module.exports = new MPesaService();
