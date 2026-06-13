# Payment Integration Guide

This guide provides instructions for implementing M-Pesa and card payment integrations in the Poketstar POS system.

## Table of Contents

1. [M-Pesa Integration](#mpesa-integration)
2. [Stripe Integration](#stripe-integration)
3. [PayPal Integration](#paypal-integration)
4. [Environment Setup](#environment-setup)
5. [Testing](#testing)
6. [Production Deployment](#production-deployment)

---

## M-Pesa Integration

### Prerequisites

- Safaricom M-Pesa Business Till Number
- Daraja API credentials (Consumer Key, Consumer Secret, Passkey)
- [Daraja Developer Account](https://developer.safaricom.co.ke/)

### Setup Steps

1. **Register on Daraja Developer Console**
   - Go to https://developer.safaricom.co.ke/
   - Create an account or log in
   - Create a new app to get Consumer Key and Consumer Secret

2. **Get Business Credentials**
   - Log in to your M-Pesa Business account
   - Navigate to settings and find your Business Short Code
   - Generate and note your Passkey

3. **Set Environment Variables**
   ```bash
   cp server/config/.env.example server/config/.env
   ```
   Then update:
   ```env
   MPESA_SHORT_CODE=your_short_code
   MPESA_CONSUMER_KEY=your_consumer_key
   MPESA_CONSUMER_SECRET=your_consumer_secret
   MPESA_PASSKEY=your_passkey
   ```

4. **Install Dependencies**
   ```bash
   npm install axios
   ```

5. **Update Server**
   - Add payment routes to your Express server:
   ```javascript
   const paymentRoutes = require('./routes/payments.routes');
   app.use('/api/payments', paymentRoutes);
   ```

### API Endpoints

#### Initiate STK Push
```bash
POST /api/payments/mpesa/initiate
Content-Type: application/json

{
  "phoneNumber": "254712345678",
  "amount": 500,
  "accountRef": "ORD-123456",
  "description": "POS Sale"
}
```

**Response:**
```json
{
  "success": true,
  "checkoutRequestId": "ws_CO_123456789",
  "message": "Success. Request accepted for processing"
}
```

#### Query Payment Status
```bash
POST /api/payments/mpesa/query
Content-Type: application/json

{
  "checkoutRequestId": "ws_CO_123456789"
}
```

#### Receive Callback
```bash
POST /api/payments/mpesa/callback
```
M-Pesa will send payment confirmation to this endpoint.

### Implementation in Frontend

```javascript
// Open payment modal
paymentUI.openPaymentModal(amount);

// Handle M-Pesa payment
paymentUI.processMpesa(
  '254712345678',
  500,
  (result) => {
    console.log('Payment successful:', result);
    // Process sale
  },
  (error) => {
    console.error('Payment failed:', error);
    // Show error to user
  }
);
```

---

## Stripe Integration

### Prerequisites

- [Stripe Account](https://stripe.com)
- Stripe API Keys (Secret and Publishable)
- Node Stripe SDK

### Setup Steps

1. **Create Stripe Account**
   - Go to https://stripe.com
   - Sign up and verify your account

2. **Get API Keys**
   - Log in to Stripe Dashboard
   - Go to Developers > API Keys
   - Copy Secret Key and Publishable Key

3. **Install Stripe SDK**
   ```bash
   npm install stripe
   ```

4. **Set Environment Variables**
   ```env
   STRIPE_SECRET_KEY=sk_test_your_key
   STRIPE_PUBLISHABLE_KEY=pk_test_your_key
   ```

5. **Add Stripe.js to Frontend**
   ```html
   <script src="https://js.stripe.com/v3/"></script>
   ```

### API Endpoints

#### Create Payment Intent
```bash
POST /api/payments/stripe/create-intent
Content-Type: application/json

{
  "amount": 500,
  "description": "POS Sale",
  "metadata": {
    "saleId": "123456"
  }
}
```

#### Confirm Payment
```bash
POST /api/payments/stripe/confirm
Content-Type: application/json

{
  "paymentIntentId": "pi_1234567890"
}
```

#### Refund Payment
```bash
POST /api/payments/stripe/refund
Content-Type: application/json

{
  "chargeId": "ch_1234567890",
  "amount": 500
}
```

### Implementation in Frontend

```javascript
const stripe = Stripe(publishableKey);
const elements = stripe.elements();

paymentUI.processStripe(
  stripe,
  elements,
  amount,
  (result) => {
    console.log('Payment successful:', result);
    // Process sale
  },
  (error) => {
    console.error('Payment failed:', error);
    // Show error to user
  }
);
```

---

## PayPal Integration

### Prerequisites

- PayPal Business Account
- PayPal API Signature or Certificate
- Client ID and Secret

### Setup Steps (Future Implementation)

PayPal integration scaffolding is included in the config. To implement:

1. Install PayPal SDK:
   ```bash
   npm install paypal-rest-sdk
   ```

2. Create `server/services/paypal.service.js`

3. Add PayPal routes to payment routes

---

## Environment Setup

### Development

1. Copy environment template:
   ```bash
   cp server/config/.env.example .env
   ```

2. Fill in your credentials:
   ```env
   MPESA_SHORT_CODE=174379
   MPESA_CONSUMER_KEY=your_key
   MPESA_CONSUMER_SECRET=your_secret
   MPESA_PASSKEY=your_passkey
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start server:
   ```bash
   npm start
   ```

### Production

1. Use live credentials:
   - M-Pesa: Production endpoint
   - Stripe: Live keys (sk_live_, pk_live_)
   - PayPal: Live signature/certificate

2. Enable SSL/HTTPS

3. Use secure environment variable storage (AWS Secrets Manager, HashiCorp Vault, etc.)

4. Set `NODE_ENV=production`

---

## Testing

### M-Pesa Testing

1. Use sandbox credentials
2. Test phone number: `254712345678`
3. Test amount: Any amount between 1 - 150,000 KES
4. Check callbacks via server logs

### Stripe Testing

1. Use test keys (sk_test_, pk_test_)
2. Test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Require auth: `4000 2500 0003 4010`
3. Any future expiration date
4. Any 3-digit CVC

### Manual Testing Steps

1. Add product to POS
2. Add to cart and proceed to checkout
3. Select payment method
4. Test each payment flow
5. Verify payment records are saved
6. Test refund flow (if applicable)

---

## Production Deployment

### Checklist

- [ ] Use production credentials
- [ ] Enable HTTPS/SSL
- [ ] Set up database for payment persistence
- [ ] Configure webhooks for payment callbacks
- [ ] Set up logging and monitoring
- [ ] Test payment flows end-to-end
- [ ] Set up alerts for failed payments
- [ ] Configure backup payment methods
- [ ] Set up PCI compliance (if handling cards)
- [ ] Document refund policy

### Security Best Practices

1. **Never commit secrets**: Use `.env` files (gitignored)
2. **Validate all inputs**: Phone numbers, amounts, etc.
3. **Encrypt sensitive data**: Use encryption utilities provided
4. **Use HTTPS**: Always in production
5. **Rate limit**: Prevent brute force attacks
6. **Log transactions**: For audit trails
7. **Monitor for fraud**: Set up alerts for unusual patterns

---

## Troubleshooting

### M-Pesa Issues

**401 Unauthorized**
- Verify Consumer Key and Secret
- Check if app is active in Daraja console

**Invalid Amount**
- Amount must be between 1 - 150,000 KES
- Amount must be numeric

**Phone Number Invalid**
- Phone must be 12 digits
- Must start with 254
- Format: 254XXXXXXXXX

### Stripe Issues

**Invalid API Key**
- Verify key hasn't been revoked
- Check if using test vs live keys appropriately

**Payment Intent Failed**
- Verify amount is valid
- Check card details in frontend
- Review Stripe dashboard for error details

---

## Support

For issues or questions:

- M-Pesa: [Daraja Support](https://developer.safaricom.co.ke/support)
- Stripe: [Stripe Support](https://support.stripe.com)
- PayPal: [PayPal Developer](https://developer.paypal.com)

---

## Resources

- [Daraja API Documentation](https://developer.safaricom.co.ke/)
- [Stripe Documentation](https://stripe.com/docs)
- [PayPal Integration Guide](https://developer.paypal.com/)
- [PCI DSS Compliance](https://www.pcisecuritystandards.org/)
