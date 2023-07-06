# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.6.20] - 2023-07-06

### Added
- `publicApiPath` optional config parameter to specify public API path

## [0.6.19] - 2023-06-30

### Changed
- use Solana RPC Url from the network info provided by the Backend instead of the default one

## [0.6.18] - 2023-06-23

### Added
- Support `hasValidToken` on Solana

## [0.6.17] - 2023-05-12

### Added
- Support for Arbitrum and zkSync networks

## [0.6.16] - 2023-05-09

### Added
- Support for BaseGoerli network

## [0.6.15] - 2023-05-03

### Changed
- better email validation regexp supporting subdomains (e.g. `@something.else.com`)

## [0.6.14] - 2023-04-21

### Changed
- global error handler will always return StatusError.UserNotLoggedIn for kycDAO responses with HTTP status 401

## [0.6.13] - 2023-04-21

### Added
- better handling of kycDAO server request errors (network and response JSON formatting errors), indicating a possible ad blocker issue
- better error handling for non-nullable EVM provider requests returning null, indicating a possible unsopported browser extension or a conflict of multiple extensions

### Changed
- Sentry will be always initialized with a separate client and hub so it always sends error logs without conflicting with 3rd party integrator sites
- StatusError.UserNotLoggedIn human readable message to include reminder to enable 3rd party cookies in browser

### Fixed
- ethereum address comparison bug
- refreshSession logical bugs that caused extra requests and a possible incorrect internal session/user state

## [0.6.12] - 2023-04-03

### Changed
- changed fee calculation to be compliant with EIP-1559 upgrade

## [0.6.11] - 2023-03-20

### Changed
- replaced hardcoded blockchain network information from data queried from the kycDAO server during initialization

## [0.6.10] - 2023-03-09

### Added
- more retriable error cases for EVM minting cost calculation related RPC methods

## [0.6.9] - 2023-03-07

### Fixed
- import path that broke the NPM package

## [0.6.8] - 2023-03-06

### Added
- `getValidNfts` implementation for NEAR

## [0.6.7] - 2023-02-27

### Changed

- Updated all dependencies
