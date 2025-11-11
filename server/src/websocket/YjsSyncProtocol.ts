import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { WebSocket } from 'ws';

/**
 * Message types for Yjs sync protocol
 */
export enum MessageType {
  SYNC = 0,
  AWARENESS = 1,
}

/**
 * Sync message types
 */
export enum SyncMessageType {
  SYNC_STEP_1 = 0, // State vector exchange
  SYNC_STEP_2 = 1, // State update
  UPDATE = 2, // Incremental update
}

/**
 * YjsSyncProtocol handles the Yjs sync protocol messages
 */
export class YjsSyncProtocol {
  /**
   * Handle incoming sync message
   * @param encoder - The encoder to write response to
   * @param decoder - The decoder to read message from
   * @param doc - The Yjs document
   * @param transactionOrigin - The origin of the transaction
   */
  static readSyncMessage(
    decoder: decoding.Decoder,
    encoder: encoding.Encoder,
    doc: Y.Doc,
    transactionOrigin: any
  ): void {
    syncProtocol.readSyncMessage(decoder, encoder, doc, transactionOrigin);
  }

  /**
   * Write sync step 1 (state vector)
   * @param encoder - The encoder to write to
   * @param doc - The Yjs document
   */
  static writeSyncStep1(encoder: encoding.Encoder, doc: Y.Doc): void {
    syncProtocol.writeSyncStep1(encoder, doc);
  }

  /**
   * Write sync step 2 (state update)
   * @param encoder - The encoder to write to
   * @param doc - The Yjs document
   * @param encodedStateVector - Optional encoded state vector
   */
  static writeSyncStep2(
    encoder: encoding.Encoder,
    doc: Y.Doc,
    encodedStateVector?: Uint8Array
  ): void {
    syncProtocol.writeSyncStep2(encoder, doc, encodedStateVector);
  }

  /**
   * Write update message
   * @param encoder - The encoder to write to
   * @param update - The update to write
   */
  static writeUpdate(encoder: encoding.Encoder, update: Uint8Array): void {
    syncProtocol.writeUpdate(encoder, update);
  }

  /**
   * Read sync step 1 and write sync step 2
   * @param decoder - The decoder to read from
   * @param encoder - The encoder to write to
   * @param doc - The Yjs document
   */
  static readSyncStep1(
    decoder: decoding.Decoder,
    encoder: encoding.Encoder,
    doc: Y.Doc
  ): void {
    syncProtocol.readSyncStep1(decoder, encoder, doc);
  }

  /**
   * Read sync step 2
   * @param decoder - The decoder to read from
   * @param doc - The Yjs document
   * @param transactionOrigin - The origin of the transaction
   */
  static readSyncStep2(
    decoder: decoding.Decoder,
    doc: Y.Doc,
    transactionOrigin: any
  ): void {
    syncProtocol.readSyncStep2(decoder, doc, transactionOrigin);
  }

  /**
   * Read update message
   * @param decoder - The decoder to read from
   * @param doc - The Yjs document
   * @param transactionOrigin - The origin of the transaction
   */
  static readUpdate(
    decoder: decoding.Decoder,
    doc: Y.Doc,
    transactionOrigin: any
  ): void {
    syncProtocol.readUpdate(decoder, doc, transactionOrigin);
  }

  /**
   * Handle incoming message from client
   * @param message - The message buffer
   * @param doc - The Yjs document
   * @param socket - The WebSocket connection
   * @returns The response message to send back, or null if no response needed
   */
  static handleMessage(
    message: Uint8Array,
    doc: Y.Doc,
    socket: WebSocket
  ): Uint8Array | null {
    const decoder = decoding.createDecoder(message);
    const encoder = encoding.createEncoder();
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MessageType.SYNC) {
      // Write message type to encoder
      encoding.writeVarUint(encoder, MessageType.SYNC);

      // Read and handle sync message
      YjsSyncProtocol.readSyncMessage(decoder, encoder, doc, socket);

      // Return encoded response
      return encoding.toUint8Array(encoder);
    }

    // For other message types, return null (will be handled elsewhere)
    return null;
  }

  /**
   * Create initial sync message (sync step 1)
   * @param doc - The Yjs document
   * @returns The encoded sync step 1 message
   */
  static createSyncStep1Message(doc: Y.Doc): Uint8Array {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MessageType.SYNC);
    YjsSyncProtocol.writeSyncStep1(encoder, doc);
    return encoding.toUint8Array(encoder);
  }

  /**
   * Create sync step 2 message
   * @param doc - The Yjs document
   * @param stateVector - Optional state vector
   * @returns The encoded sync step 2 message
   */
  static createSyncStep2Message(
    doc: Y.Doc,
    stateVector?: Uint8Array
  ): Uint8Array {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MessageType.SYNC);
    YjsSyncProtocol.writeSyncStep2(encoder, doc, stateVector);
    return encoding.toUint8Array(encoder);
  }

  /**
   * Create update message
   * @param update - The update to send
   * @returns The encoded update message
   */
  static createUpdateMessage(update: Uint8Array): Uint8Array {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MessageType.SYNC);
    YjsSyncProtocol.writeUpdate(encoder, update);
    return encoding.toUint8Array(encoder);
  }
}
