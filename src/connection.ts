/*
 * MIT License (MIT)
 * Copyright (c) 2018 Activeledger
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { ActiveCrypto } from "@activeledger/activecrypto";
import Axios, { AxiosResponse } from "axios";
import { IBaseTransaction, IHttpOptions, ILedgerResponse, INodeKeyData } from './interfaces';

export class Connection {
  private protocol: string;
  private address: string;
  private port: number;

  private encryptTx = false;

  private httpOptions: IHttpOptions;

  private encryptedHeaders = {
    "Content-Type": "application/json",
    "X-Activeledger-Encrypt": "1",
  };

  /**
   * Creates an instance of Connection.
   * @param {string} protocol - The protocol to use, usually http or https
   * @param {string} address - The URL or IP of the node
   * @param {number} portNumber - The port number of the node
   * @param {boolean} [encrypt] - Optional: Set to true to encrypt the transaction before sending
   * @memberof Connection
   */
  constructor(protocol: string, address: string, portNumber: number, encrypt?: boolean) {
    this.httpOptions = {
      baseURL: protocol + "://" + address + ":" + portNumber,
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      port: portNumber,
    };

    this.protocol = protocol;
    this.address = address;
    this.port = portNumber;

    if (encrypt) {
      this.encryptTx = encrypt;
    }
  }

  /**
   * Send a transaction to the specified ledger
   *
   * @param {IBaseTransaction} txBody - The Body of the transaction
   * @param {boolean} [encrypt] - Whether or not the transaction should be encrypted
   * @returns {Promise<ILedgerResponse>} Returns the ledger response
   * @memberof Connection
   */
  public sendTransaction(txBody: IBaseTransaction): Promise<ILedgerResponse> {
    return new Promise((resolve, reject) => {
      if (this.encryptTx) {
        // Handle encrypted transactions
        this.httpOptions.headers = this.encryptedHeaders;
        this.encrypt(txBody)
          .then((encryptedTx: string) => {
            this.postTransaction(encryptedTx)
              .then((resp: ILedgerResponse) => {
                resolve(resp);
              })
              .catch((err: any) => {
                reject(err);
              });
          })
          .catch((err: any) => {
            reject(err);
          });
      } else {
        // Handle normal transactions
        this.postTransaction(txBody)
          .then((resp: ILedgerResponse) => {
            resolve(resp);
          })
          .catch((err: any) => {
            reject(err);
          });
      }
    });
  }

  /**
   * POST the provided transaction to the ledger
   *
   * @private
   * @param {(string | IBaseTransaction)} tx - The transaction to POST
   * @returns {Promise<ILedgerResponse>} Returns the ledger response
   * @memberof Connection
   */
  private postTransaction(tx: string | IBaseTransaction): Promise<ILedgerResponse> {
    return new Promise((resolve, reject) => {
      
      this.httpOptions.data = tx;

      Axios(this.httpOptions)
      .then((resp: AxiosResponse) => {
        resolve(resp.data as ILedgerResponse);
      })
      .catch((err: any) => {
        reject(err);
      });
      
    });
  }

  /**
   * Encrypts the transaction if requested
   *
   * @private
   * @param {IBaseTransaction} txBody - The transaction to encrypt
   * @returns {Promise<string>} Returns the encrypted data as a string
   * @memberof Connection
   */
  private encrypt(txBody: IBaseTransaction): Promise<string> {
    return new Promise((resolve, reject) => {
      this.getNodeKeyData()
        .then((keyData: INodeKeyData) => {
          try {
            const keyPair = new ActiveCrypto.KeyPair("rsa", keyData.pem);
            resolve(keyPair.encrypt(txBody));
          } catch (e) {
            reject(e);
          }
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Get the key data from the node specified in the connection
   *
   * @private
   * @returns {Promise<INodeKeyData>} Returns the nodes key data
   * @memberof Connection
   */
  private getNodeKeyData(): Promise<INodeKeyData> {
    return new Promise((resolve, reject) => {
      const url = `${this.protocol}://${this.address}:${this.port}/a/status`;

      Axios.get(url)
      .then((resp: AxiosResponse) => {
        const jsonData = resp.data;

        const nodeKey: INodeKeyData = {
          encryption: "rsa",
          pem: Buffer.from(jsonData.pem, "base64").toString(),
        };

        resolve(nodeKey);
      })
      .catch((err: any) => {
        reject(err);
      });

    });
  }
}
