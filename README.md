---
label: kycDAO SDK for integration into web3 sites
layout: page
order: 100
---

![](https://blog.kycdao.xyz/content/images/2022/05/docs-cover.jpg)

kycDAO JS/TS SDK canonical URL: https://github.com/kycdao/kycdao-js-sdk

[kycDAO](https://kycdao.xyz/home) creates a shared bridge of on-chain verification proofs that enable web3 service providers to deliver products to trusted users across ecosystems and blockchains. Non-transferable NFTs are minted as proof-of-verifications (no PII) to enable compliant composability while eliminating data duplication. kycNFTs are the base for a permissionless identity and serve as a unique web3 version of a twitter tick. 

## Install

+++ NPM

```
npm install @kycdao/kycdao-sdk
```

+++ Yarn

```
yarn add @kycdao/kycdao-sdk
```

+++

hard dependencies
persona
https://www.npmjs.com/package/persona
https://docs.withpersona.com/docs/quickstart-embedded-flow

peer deps
NEAR SDK
ethers.js ?

## Getting Started

[code snippets]

```html
<script
  src="https://cdn.jsdelivr.net/npm/@kycdao/kycdao-sdk@0.0.10/dist/kycdao-sdk.min.js"
  integrity="sha384-EkM62DbzFuHaWvBiD6SD2rFnI1j9JrTjcgeNR21X4POxyK+ya9s3rTrtH2p61k+a"
  crossorigin="anonymous"
></script>
```

Please make sure the subresource integrity hash is correct: https://unpkg.com/@kycdao/kycdao-sdk@0.0.10/dist/index.js?meta

## Integration example

Example repository at https://github.com/kycdao/sdk-example
