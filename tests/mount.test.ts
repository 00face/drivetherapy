import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveDirectoryHandle,
  setActiveDirectoryHandle,
  writeSidecarToMountedDirectory,
  reconnectMountedDirectory,
} from '../src/services/localFileSystem.ts';
import { BatchTask } from '../src/types/index.ts';

describe('Local In-Place Mount & Sidecar Persistence Verification Suite', () => {

  test('BatchTask supports mount task type with 0MB upload metadata', () => {
    const mountTask: BatchTask = {
      id: 'task_mount_test_1',
      name: 'Live Mount: 42 files in-place',
      type: 'mount',
      progress: 100,
      status: 'completed',
    };

    assert.equal(mountTask.type, 'mount');
    assert.equal(mountTask.status, 'completed');
    assert.match(mountTask.name, /Live Mount/);
  });

  test('activeDirectoryHandles registry stores and retrieves handles by folderId', () => {
    const mockFolderId = 'folder_local_session_999';
    const mockHandle = {
      kind: 'directory',
      name: 'Photoshoot_2026',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
    } as unknown as FileSystemDirectoryHandle;

    // Initially undefined
    assert.equal(getActiveDirectoryHandle(mockFolderId), undefined);

    // After setting
    setActiveDirectoryHandle(mockFolderId, mockHandle);
    const retrieved = getActiveDirectoryHandle(mockFolderId);
    assert.ok(retrieved !== undefined, 'Handle should be present');
    assert.equal(retrieved?.name, 'Photoshoot_2026');
  });

  test('reconnectMountedDirectory returns false when no handle exists in memory or storage', async () => {
    const result = await reconnectMountedDirectory('non_existent_folder_id');
    assert.equal(result.success, false, 'Reconnecting non-existent folder should gracefully return false');
    assert.ok(result.error?.includes('not found'));
  });

  test('writeSidecarToMountedDirectory returns false when directory handle is absent', async () => {
    const result = await writeSidecarToMountedDirectory(
      'missing_folder_id',
      'IMG_4500.CR3',
      '<x:xmpmeta>test</x:xmpmeta>'
    );
    assert.equal(result, false, 'Writing sidecar to missing directory should return false without throwing');
  });

  test('writeSidecarToMountedDirectory creates and writes .xmp sidecar directly to handle', async () => {
    let writtenFileName = '';
    let writtenContent = '';
    let writeClosed = false;

    const mockFileHandle = {
      createWritable: async () => ({
        write: async (content: string) => {
          writtenContent = content;
        },
        close: async () => {
          writeClosed = true;
        },
      }),
    };

    const mockDirHandle = {
      kind: 'directory',
      name: 'Sony_RAW_Folder',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFileHandle: async (name: string, options?: { create?: boolean }) => {
        writtenFileName = name;
        assert.equal(options?.create, true, 'Must request file handle with create: true');
        return mockFileHandle;
      },
    } as unknown as FileSystemDirectoryHandle;

    const folderId = 'folder_sony_raw_123';
    setActiveDirectoryHandle(folderId, mockDirHandle);

    const testXmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description xmp:Rating="5" />
  </rdf:RDF>
</x:xmpmeta>`;

    const success = await writeSidecarToMountedDirectory(folderId, 'SONY_0042.ARW', testXmp);

    assert.equal(success, true, 'Write should report success');
    assert.equal(writtenFileName, 'SONY_0042.xmp', 'File name should replace original extension with .xmp');
    assert.equal(writtenContent, testXmp, 'XMP content must be written verbatim to disk');
    assert.equal(writeClosed, true, 'Writable stream must be closed properly');
  });

  test('reconnectMountedDirectory prompts for permission and returns true when granted', async () => {
    let permissionRequested = false;

    const mockDirHandle = {
      kind: 'directory',
      name: 'Reconnected_Studio_Folder',
      queryPermission: async () => 'prompt',
      requestPermission: async () => {
        permissionRequested = true;
        return 'granted';
      },
      values: async function* () {
        // empty dir in test
      },
    } as unknown as FileSystemDirectoryHandle;

    const folderId = 'folder_to_reconnect';
    setActiveDirectoryHandle(folderId, mockDirHandle);

    const res = await reconnectMountedDirectory(folderId);
    assert.equal(permissionRequested, true, 'Permission should have been prompted');
    assert.equal(res.success, true, 'Should report successfully reconnected');
    assert.equal(res.folder?.name, 'Reconnected_Studio_Folder');
  });

});
