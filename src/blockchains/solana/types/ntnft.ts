export type Ntnft = {
  version: '0.1.0';
  name: 'ntnft';
  instructions: [
    {
      name: 'hasValidToken';
      accounts: [
        {
          name: 'status';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'addr';
          type: 'publicKey';
        },
      ];
      returns: 'bool';
    },
    {
      name: 'mintWithArgs';
      accounts: [
        {
          name: 'collection';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wallet';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'metadata';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'associatedAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mintAuthority';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'feePayer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'priceFeed';
          isMut: true;
          isSigner: false;
          docs: ['TODO: We need to ensure we have the right price_feed, store in the collection?'];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenMetadataProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'secondsToPay';
          type: 'u64';
        },
        {
          name: 'metadataCid';
          type: 'string';
        },
      ];
    },
    {
      name: 'initStatus';
      accounts: [
        {
          name: 'collection';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'receiver';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'status';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'data';
          type: {
            defined: 'KycDaoNftStatusData';
          };
        },
      ];
    },
    {
      name: 'updateStatus';
      accounts: [
        {
          name: 'collection';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'status';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: 'data';
          type: {
            defined: 'KycDaoNftStatusData';
          };
        },
      ];
    },
    {
      name: 'initializeKycdaonftCollection';
      accounts: [
        {
          name: 'kycdaoNftCollection';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wallet';
          isMut: false;
          isSigner: false;
          docs: ['TODO: Why do we need the constraint check on wallet here?'];
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
          docs: ['TODO: Why do we need the constraint check on authority here?'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'bump';
          type: 'u8';
        },
        {
          name: 'data';
          type: {
            defined: 'KycDaoNftCollectionData';
          };
        },
      ];
    },
    {
      name: 'updateKycdaonftCollection';
      accounts: [
        {
          name: 'kycdaoNftCollection';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wallet';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: 'bump';
          type: 'u8';
        },
        {
          name: 'data';
          type: {
            defined: 'KycDaoNftCollectionData';
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: 'kycDaoNftCollection';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'authority';
            type: 'publicKey';
          },
          {
            name: 'wallet';
            type: 'publicKey';
          },
          {
            name: 'data';
            type: {
              defined: 'KycDaoNftCollectionData';
            };
          },
        ];
      };
    },
    {
      name: 'kycDaoNftStatus';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'data';
            type: {
              defined: 'KycDaoNftStatusData';
            };
          },
        ];
      };
    },
  ];
  types: [
    {
      name: 'KycDaoNftCollectionData';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'ethSigner';
            type: {
              array: ['u8', 20];
            };
          },
          {
            name: 'pricePerYear';
            type: 'u64';
          },
          {
            name: 'nftsMinted';
            type: 'u64';
          },
          {
            name: 'symbol';
            type: 'string';
          },
          {
            name: 'name';
            type: 'string';
          },
          {
            name: 'baseUrl';
            type: 'string';
          },
        ];
      };
    },
    {
      name: 'KycDaoNftStatusData';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'isValid';
            type: 'bool';
          },
          {
            name: 'expiry';
            type: 'u64';
          },
          {
            name: 'verificationTier';
            type: 'string';
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'InvalidDataProvided';
      msg: "SECP256K1 program or length doesn't match";
    },
    {
      code: 6001;
      name: 'SignatureVerificationFailed';
      msg: 'The signature data provided to validate the metadata is incorrect';
    },
    {
      code: 6002;
      name: 'NotEnoughSOL';
      msg: "You don't have enough SOL to mint this NFT";
    },
    {
      code: 6003;
      name: 'CandyMachineEmpty';
      msg: 'There are no more NFTs to mint in this collection';
    },
    {
      code: 6004;
      name: 'InvalidAuthority';
      msg: 'The authority provided is not valid';
    },
    {
      code: 6005;
      name: 'InvalidAuthMint';
      msg: 'The authMint provided is not valid';
    },
  ];
};

export const IDL: Ntnft = {
  version: '0.1.0',
  name: 'ntnft',
  instructions: [
    {
      name: 'hasValidToken',
      accounts: [
        {
          name: 'status',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'addr',
          type: 'publicKey',
        },
      ],
      returns: 'bool',
    },
    {
      name: 'mintWithArgs',
      accounts: [
        {
          name: 'collection',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wallet',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'metadata',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'associatedAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mintAuthority',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'feePayer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'priceFeed',
          isMut: true,
          isSigner: false,
          docs: ['TODO: We need to ensure we have the right price_feed, store in the collection?'],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenMetadataProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'secondsToPay',
          type: 'u64',
        },
        {
          name: 'metadataCid',
          type: 'string',
        },
      ],
    },
    {
      name: 'initStatus',
      accounts: [
        {
          name: 'collection',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'receiver',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'status',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'data',
          type: {
            defined: 'KycDaoNftStatusData',
          },
        },
      ],
    },
    {
      name: 'updateStatus',
      accounts: [
        {
          name: 'collection',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'status',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: 'data',
          type: {
            defined: 'KycDaoNftStatusData',
          },
        },
      ],
    },
    {
      name: 'initializeKycdaonftCollection',
      accounts: [
        {
          name: 'kycdaoNftCollection',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wallet',
          isMut: false,
          isSigner: false,
          docs: ['TODO: Why do we need the constraint check on wallet here?'],
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
          docs: ['TODO: Why do we need the constraint check on authority here?'],
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'bump',
          type: 'u8',
        },
        {
          name: 'data',
          type: {
            defined: 'KycDaoNftCollectionData',
          },
        },
      ],
    },
    {
      name: 'updateKycdaonftCollection',
      accounts: [
        {
          name: 'kycdaoNftCollection',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wallet',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: 'bump',
          type: 'u8',
        },
        {
          name: 'data',
          type: {
            defined: 'KycDaoNftCollectionData',
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: 'kycDaoNftCollection',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'authority',
            type: 'publicKey',
          },
          {
            name: 'wallet',
            type: 'publicKey',
          },
          {
            name: 'data',
            type: {
              defined: 'KycDaoNftCollectionData',
            },
          },
        ],
      },
    },
    {
      name: 'kycDaoNftStatus',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'data',
            type: {
              defined: 'KycDaoNftStatusData',
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      name: 'KycDaoNftCollectionData',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'ethSigner',
            type: {
              array: ['u8', 20],
            },
          },
          {
            name: 'pricePerYear',
            type: 'u64',
          },
          {
            name: 'nftsMinted',
            type: 'u64',
          },
          {
            name: 'symbol',
            type: 'string',
          },
          {
            name: 'name',
            type: 'string',
          },
          {
            name: 'baseUrl',
            type: 'string',
          },
        ],
      },
    },
    {
      name: 'KycDaoNftStatusData',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'isValid',
            type: 'bool',
          },
          {
            name: 'expiry',
            type: 'u64',
          },
          {
            name: 'verificationTier',
            type: 'string',
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: 'InvalidDataProvided',
      msg: "SECP256K1 program or length doesn't match",
    },
    {
      code: 6001,
      name: 'SignatureVerificationFailed',
      msg: 'The signature data provided to validate the metadata is incorrect',
    },
    {
      code: 6002,
      name: 'NotEnoughSOL',
      msg: "You don't have enough SOL to mint this NFT",
    },
    {
      code: 6003,
      name: 'CandyMachineEmpty',
      msg: 'There are no more NFTs to mint in this collection',
    },
    {
      code: 6004,
      name: 'InvalidAuthority',
      msg: 'The authority provided is not valid',
    },
    {
      code: 6005,
      name: 'InvalidAuthMint',
      msg: 'The authMint provided is not valid',
    },
  ],
};
