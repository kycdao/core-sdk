---
icon: rocket
label: Getting started
order: 0
---

This SDK is designed to enable web3 projects to integrate kycDAO verification flow into their website with the maximum flexibility around UI/UX.

kycDAO JS/TS SDK canonical URL: https://github.com/kycdao/core-sdk

## Integration steps

[!badge variant="contrast" size="l" text="Step 1" corners="pill"] Installation

The SDK can be used two ways:
1. by installing the NPM package
2. by embedding the browser compatible JavaScript code directly into HTML (with the help of a CDN service like `jsDelivr`)

When using the NPM package make sure to install the peer dependencies as well.

+++ NPM
```bash
npm install near-api-js persona react react-dom styled-components @kycdao/kycdao-sdk
```

+++ Yarn
```bash
yarn add near-api-js persona react react-dom styled-components @kycdao/kycdao-sdk
```

+++ HTML
```html
<script
  src="https://cdn.jsdelivr.net/npm/@kycdao/kycdao-sdk@0.4.2/dist/kycdao-sdk.min.js"
  integrity="sha256-mbKIQDqxeJTz0v6eSxcayZclL46J+43By6VVrVUWLSY="
  crossorigin="anonymous">
<script>
```

You can always find all versions and generate script tags for them at https://www.jsdelivr.com/package/npm/@kycdao/kycdao-sdk. We encourage using a specific version and checking for updates reqularly rather then defaulting to the latest version, to avoid potential compatibility issues.
+++

[!badge variant="contrast" size="l" text="Step 2" corners="pill"] Initialization

The SDK has an asynchronous initializer method which returns the SDK object as one of its fields which can be used to acccess the SDK methods. For details on the configuration options check out the API reference.

+++ Package
```typescript
import {
  BlockchainNetworks,
  KycDao,
  KycDaoInitializationResult,
  SdkConfiguration,
  VerificationTypes,
} from '@kycdao/kycdao-sdk';

const kycDaoSdkConfig: SdkConfiguration = {
  baseUrl: 'https://staging.kycdao.xyz',
  enabledBlockchainNetworks: [BlockchainNetworks.NearTestnet, BlockchainNetworks.PolygonMumbai],
  enabledVerificationTypes: [VerificationTypes.KYC],
  demoMode: true,
  evmProvider: window.ethereum,
};

const kycDaoInitResult: KycDaoInitializationResult = await KycDao.initialize(kycDaoSdkConfig);

const kycDao: KycDao = kycDaoInitResult.kycDao;
```

+++ Embed
```javascript
const kycDaoSdkConfig = {
  baseUrl: "https://staging.kycdao.xyz",
  enabledBlockchainNetworks: ["NearTestnet", "PolygonMumbai"],
  enabledVerificationTypes: ["KYC"],
  demoMode: true,
  evmProvider: window.ethereum,
};

const kycDaoInitResult = await window.kycDaoSdk.init(kycDaoSdkConfig);

window.kycDao = kycDaoInitResult.kycDao;
```
+++

## Integration example

An example repository using the embedded method: https://github.com/kycdao/sdk-example
