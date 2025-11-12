import * as Y from 'yjs';
import { describe, test, expect, beforeEach } from 'vitest';

/**
 * CRDT Convergence Tests
 * 
 * These tests verify that Yjs CRDT guarantees eventual consistency
 * when multiple clients make concurrent edits to the same document.
 * 
 * Requirements: 11.1 - CRDT/OT logic with deterministic unit tests
 */

describe('CRDT Convergence Tests', () => {
  let doc1: Y.Doc;
  let doc2: Y.Doc;
  let doc3: Y.Doc;

  beforeEach(() => {
    doc1 = new Y.Doc();
    doc2 = new Y.Doc();
    doc3 = new Y.Doc();
  });

  describe('Concurrent Inserts', () => {
    test('concurrent inserts at different positions converge to same state', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: "Hello"
      text1.insert(0, 'Hello');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Concurrent inserts at different positions
      text1.insert(5, ' World'); // doc1: "Hello World"
      text2.insert(0, 'Hi ');     // doc2: "Hi Hello"

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both documents should converge to same state
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString()).toBe('Hi Hello World');
    });

    test('concurrent inserts at same position converge deterministically', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: "Hello"
      text1.insert(0, 'Hello');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Concurrent inserts at same position
      text1.insert(5, '!');
      text2.insert(5, '?');

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both documents should converge to same state
      // Yjs uses client ID to break ties deterministically
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString().length).toBe(7); // "Hello" + 2 chars
    });

    test('three-way concurrent inserts converge', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');
      const text3 = doc3.getText('content');

      // Initial state: "ABC"
      text1.insert(0, 'ABC');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc3, update1);

      // Three concurrent inserts
      text1.insert(1, '1'); // "A1BC"
      text2.insert(2, '2'); // "AB2C"
      text3.insert(3, '3'); // "ABC3"

      // Exchange all updates
      const update1_full = Y.encodeStateAsUpdate(doc1);
      const update2_full = Y.encodeStateAsUpdate(doc2);
      const update3_full = Y.encodeStateAsUpdate(doc3);

      Y.applyUpdate(doc1, update2_full);
      Y.applyUpdate(doc1, update3_full);
      Y.applyUpdate(doc2, update1_full);
      Y.applyUpdate(doc2, update3_full);
      Y.applyUpdate(doc3, update1_full);
      Y.applyUpdate(doc3, update2_full);

      // All three documents should converge
      const finalState = text1.toString();
      expect(text2.toString()).toBe(finalState);
      expect(text3.toString()).toBe(finalState);
      expect(finalState).toContain('A');
      expect(finalState).toContain('B');
      expect(finalState).toContain('C');
      expect(finalState).toContain('1');
      expect(finalState).toContain('2');
      expect(finalState).toContain('3');
    });

    test('interleaved inserts converge correctly', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: empty
      // Client 1 inserts "ace"
      text1.insert(0, 'a');
      text1.insert(1, 'c');
      text1.insert(2, 'e');

      // Client 2 inserts "bdf"
      text2.insert(0, 'b');
      text2.insert(1, 'd');
      text2.insert(2, 'f');

      // Exchange updates
      const update1 = Y.encodeStateAsUpdate(doc1);
      const update2 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc1, update2);

      // Both should converge
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString().length).toBe(6);
    });
  });

  describe('Concurrent Deletes', () => {
    test('concurrent deletes at different positions preserve intent', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: "Hello World"
      text1.insert(0, 'Hello World');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Concurrent deletes
      text1.delete(0, 6);  // Delete "Hello " -> "World"
      text2.delete(6, 5);  // Delete "World" -> "Hello "

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both documents should converge (both deletes applied)
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString()).toBe('');
    });

    test('delete of already deleted content is idempotent', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: "ABCDE"
      text1.insert(0, 'ABCDE');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Both clients delete same range
      text1.delete(1, 3); // Delete "BCD" -> "AE"
      text2.delete(1, 3); // Delete "BCD" -> "AE"

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both should converge to "AE"
      expect(text1.toString()).toBe('AE');
      expect(text2.toString()).toBe('AE');
    });

    test('overlapping deletes converge correctly', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: "ABCDEFGH"
      text1.insert(0, 'ABCDEFGH');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Overlapping deletes
      text1.delete(2, 4); // Delete "CDEF" -> "ABGH"
      text2.delete(4, 3); // Delete "EFG" -> "ABCDH"

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both should converge
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString()).toBe('ABH');
    });
  });

  describe('Mixed Operations', () => {
    test('concurrent insert and delete converge correctly', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: "Hello World"
      text1.insert(0, 'Hello World');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Client 1 inserts, Client 2 deletes
      text1.insert(5, ' Beautiful'); // "Hello Beautiful World"
      text2.delete(6, 5);            // "Hello "

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both should converge
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString()).toBe('Hello Beautiful ');
    });

    test('insert at deleted position preserves insert', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: "ABC"
      text1.insert(0, 'ABC');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Client 1 deletes "B", Client 2 inserts at position of "B"
      text1.delete(1, 1);  // "AC"
      text2.insert(2, 'X'); // "ABXC"

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both should converge - insert is preserved
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString()).toContain('X');
    });

    test('complex mixed operations converge', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');
      const text3 = doc3.getText('content');

      // Initial state: "The quick brown fox"
      text1.insert(0, 'The quick brown fox');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc3, update1);

      // Client 1: Insert " lazy" at end
      text1.insert(19, ' lazy');

      // Client 2: Delete "quick " and insert "slow "
      text2.delete(4, 6);
      text2.insert(4, 'slow ');

      // Client 3: Insert " red" after "brown"
      text3.insert(14, ' red');

      // Exchange all updates
      const update1_full = Y.encodeStateAsUpdate(doc1);
      const update2_full = Y.encodeStateAsUpdate(doc2);
      const update3_full = Y.encodeStateAsUpdate(doc3);

      Y.applyUpdate(doc1, update2_full);
      Y.applyUpdate(doc1, update3_full);
      Y.applyUpdate(doc2, update1_full);
      Y.applyUpdate(doc2, update3_full);
      Y.applyUpdate(doc3, update1_full);
      Y.applyUpdate(doc3, update2_full);

      // All three should converge
      const finalState = text1.toString();
      expect(text2.toString()).toBe(finalState);
      expect(text3.toString()).toBe(finalState);
      expect(finalState).toContain('The');
      expect(finalState).toContain('slow');
      expect(finalState).toContain('red');
      expect(finalState).toContain('fox');
      expect(finalState).toContain('lazy');
    });

    test('rapid sequential operations converge', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: "test"
      text1.insert(0, 'test');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Client 1: Multiple rapid operations
      text1.insert(4, '1');
      text1.insert(5, '2');
      text1.insert(6, '3');
      text1.delete(0, 1);

      // Client 2: Multiple rapid operations
      text2.insert(0, 'a');
      text2.insert(1, 'b');
      text2.delete(6, 1);

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both should converge
      expect(text1.toString()).toBe(text2.toString());
    });
  });

  describe('Deterministic Scenarios', () => {
    test('known scenario: collaborative sentence building', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Scenario: Two users building "The cat sat on the mat"
      // User 1 types: "The cat"
      text1.insert(0, 'The cat');

      // User 2 types: "sat on the mat"
      text2.insert(0, 'sat on the mat');

      // Sync
      const update1 = Y.encodeStateAsUpdate(doc1);
      const update2 = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc1, update2);

      // User 1 adds space and continues
      text1.insert(7, ' ');

      // Sync again
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1_2);

      // Both should have same content
      expect(text1.toString()).toBe(text2.toString());
    });

    test('known scenario: collaborative code editing', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial: function stub
      text1.insert(0, 'function test() {\n  \n}');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // User 1 adds return statement
      text1.insert(20, 'return true;');

      // User 2 adds parameter
      text2.insert(14, 'value');

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both should converge
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString()).toContain('function test(value)');
      expect(text1.toString()).toContain('return true;');
    });

    test('known scenario: delete and insert at same position', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state: "Hello World"
      text1.insert(0, 'Hello World');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // User 1 deletes "World" and inserts "Everyone"
      text1.delete(6, 5);
      text1.insert(6, 'Everyone');

      // User 2 inserts "Beautiful " before "World"
      text2.insert(6, 'Beautiful ');

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both should converge
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString()).toContain('Hello');
      expect(text1.toString()).toContain('Beautiful');
      expect(text1.toString()).toContain('Everyone');
    });
  });

  describe('Edge Cases', () => {
    test('empty document operations converge', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Both start empty and insert at position 0
      text1.insert(0, 'A');
      text2.insert(0, 'B');

      // Exchange updates
      const update1 = Y.encodeStateAsUpdate(doc1);
      const update2 = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc1, update2);

      // Both should converge
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString().length).toBe(2);
    });

    test('single character operations converge', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial: "X"
      text1.insert(0, 'X');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Both delete the character
      text1.delete(0, 1);
      text2.delete(0, 1);

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both should be empty
      expect(text1.toString()).toBe('');
      expect(text2.toString()).toBe('');
    });

    test('large concurrent operations converge', () => {
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');

      // Initial state
      text1.insert(0, 'START');
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Large inserts
      const largeText1 = 'A'.repeat(1000);
      const largeText2 = 'B'.repeat(1000);

      text1.insert(5, largeText1);
      text2.insert(5, largeText2);

      // Exchange updates
      const update1_2 = Y.encodeStateAsUpdate(doc1);
      const update2_1 = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc2, update1_2);
      Y.applyUpdate(doc1, update2_1);

      // Both should converge
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString().length).toBe(2005); // START + 2000 chars
    });
  });
});
