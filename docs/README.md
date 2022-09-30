---
icon: rocket
label: Getting started
order: 0
---

![](https://blog.kycdao.xyz/content/images/2022/05/docs-cover.jpg)

kycDAO JS/TS SDK canonical URL: https://github.com/kycdao/kycdao-js-sdk

[kycDAO](https://kycdao.xyz/home) creates a shared bridge of on-chain verification proofs that enable web3 service providers to deliver products to trusted users across ecosystems and blockchains. Non-transferable NFTs are minted as proof-of-verifications (no PII) to enable compliant composability while eliminating data duplication. kycNFTs are the base for a permissionless identity and serve as a unique web3 version of a twitter tick.


## Installation

The SDK can be used two ways:
1. by installing the NPM package
2. by embedding the browser compatible JavaScript code directly into HTML (with the help of a CDN service like `jsDelivr`)

When using the NPM package make sure to install the peer dependencies as well.

+++ NPM
```
npm install near-api-js persona react react-dom styled-components @kycdao/kycdao-sdk
```

+++ Yarn
```
yarn add near-api-js persona react react-dom styled-components @kycdao/kycdao-sdk
```

+++ HTML
```html
<script
  src="https://cdn.jsdelivr.net/npm/@kycdao/kycdao-sdk@0.2.0/dist/kycdao-sdk.min.js"
  integrity="sha256-A1Qb6wilgW2Nzara9H3nCIM7UIAHA51EU0ILVbj+kzA="
  crossorigin="anonymous">
</script>
```

You can always find all versions and generate script tags for them at https://www.jsdelivr.com/package/npm/@kycdao/kycdao-sdk
+++

## Initialization

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
