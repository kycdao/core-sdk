---
icon: workflow
label: Flows
order: -1
---

<style>
  .mermaid-wrapper .mermaid svg {
      height: auto;
  }
</style>

### EVM flow

The main focus of this sequence diagram is to provide a better understanding on the required interaction between the SDK and the integrating host page. Communication between our services and certain third party providers are intentionally not detailed.

:::mermaid-wrapper

```mermaid
%%{init: { 'theme': 'neutral' } }%%
sequenceDiagram
  participant Host as Host page
  participant SDK
  participant User
  participant Wallet as Wallet provider
  participant Backend as kycDAO backend
  participant Contract as Smart contract

  Host ->>+ SDK: initialize()
  SDK -->>- Host: KycDaoInitializationResult

  User ->>+ Host: Start kycDAO flow

  Note over Host, Contract: Wallet connection and authentication

  Host ->>+ SDK: connectWallet()
  SDK ->>+ Wallet: Get connected wallet
  alt has connected wallet
    Wallet -->> SDK: Wallet
  else connection required
    Wallet ->>+ User: Ask for connection
    User -->>- Wallet: Connect wallet
    Wallet -->>- SDK: Wallet
  end
  SDK -->>- Host: Wallet connected

  Host ->>+ SDK: registerOrLogin()
  SDK ->>+ Backend: Validate Session
  alt Session valid for connected wallet
    Backend -->> SDK: Session
  else Session missing or invalid
    SDK ->>+ Wallet: Sign login message
    Wallet ->>+ User: Ask for signature
    User -->>- Wallet: Sign
    Wallet -->>- SDK: Signed message
    SDK ->>+ Backend: Create or log in User
    Backend -->>- SDK: User
  end
  SDK -->>- Host: User logged in

  Note over Host, Contract: Verification

  Host ->>+ SDK: startVerification()
  SDK ->>+ Backend: Update User
  Backend -->>- SDK: User
  Note over SDK: Start verification by 3rd party provider
  SDK -->>- Host: Verification started

  loop check verification status until verified
    Host ->>+ SDK: checkVerificationStatus()
    SDK ->>+ Backend: Fetch User
    Backend -->>- SDK: User
    alt not verified
      SDK -->> Host: Not verified
    else verified
      SDK -->>- Host: Verified
    end
  end

  Note over Host, Contract: NFT minting

  Host ->>+ SDK: startMinting()
  SDK ->> SDK: Check if verified
  alt not verified
    SDK -->> Host: Not verified
  else
    SDK ->>+ Backend: Authorize minting
    Backend ->>+ Contract: Authorize minting
    Contract -->>- Backend: Transaction hash
    Backend -->>- SDK: Transaction hash

    loop check transaction until finished
      SDK ->>+ Wallet: Check transaction
      alt not finished
        Wallet -->> SDK: Not finished
      else finished
        Wallet -->>- SDK: Finished
      end
    end

    SDK ->>+ Wallet: Send minting transaction
    Wallet ->>+ User: Ask for signature
    User -->>- Wallet: Sign
    Wallet ->>+ Contract: Mint
    Contract -->>- Wallet: Transaction hash
    Wallet -->>- SDK: Transaction hash

    loop check transaction until finished
      SDK ->>+ Wallet: Check transaction
      alt not finished
        Wallet -->> SDK: Not finished
      else finished
        Wallet -->>- SDK: Finished
      end
    end
  end
  SDK ->>+ Backend: Update Token
  Backend -->>- SDK: Token
  SDK -->>- Host: NFT minted

  deactivate Host
```

:::
