/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Native Format Database CLI & Flat-File Generator
 * Builds, validates, queries, inspects, and updates `src/data/fileFormatsDatabase.json`.
 *
 * Usage:
 *   npx tsx scripts/formatDbTool.ts build
 *   npx tsx scripts/formatDbTool.ts stats
 *   npx tsx scripts/formatDbTool.ts validate
 *   npx tsx scripts/formatDbTool.ts lookup <ext-or-filepath>
 *   npx tsx scripts/formatDbTool.ts upsert --ext EXT --name "Format Name" --family document --category document [--mime text/plain] [--viewer document-reader] [--editor text-code-editor]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  FileFormatDatabaseDocument,
  FileFormatDefinition,
  FormatEditorKind,
  FormatFamily,
  FormatViewerKind,
  MagicSignatureSpec,
  PreservationGrade,
} from '../src/types/fileFormats';
import type { MediaCategory } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DB_PATH = path.resolve(__dirname, '../src/data/fileFormatsDatabase.json');

interface SeedOptions {
  aliases?: string[];
  magic?: MagicSignatureSpec[];
  container?: string;
  parsers?: string[];
  viewer?: FormatViewerKind;
  editor?: FormatEditorKind;
  lossless?: boolean;
  streamable?: boolean;
  grade?: PreservationGrade;
  desc: string;
}

const DEFAULT_PARSERS: Record<FormatFamily, string[]> = {
  raster_image: ['image-dimensions', 'exif', 'icc-profile'],
  camera_raw: ['raw-demosaic', 'exif', 'embedded-jpeg', 'xmp'],
  vector_graphic: ['xml-dom', 'svg-viewbox'],
  design_layout: ['layer-manifest', 'xmp', 'icc-profile'],
  cad_3d: ['mesh-geometry', 'scene-graph'],
  video: ['container-atoms', 'video-stream', 'audio-stream'],
  audio: ['audio-header', 'id3-vorbis-tags', 'lrc-lyrics'],
  document: ['text-encoding', 'document-structure'],
  ebook: ['opf-manifest', 'toc-metadata'],
  spreadsheet: ['tabular-columns', 'sheet-names'],
  presentation: ['slide-deck-manifest', 'notes'],
  subtitle_lyric: ['cue-timestamps', 'text-encoding'],
  database: ['sqlite-header', 'schema-tables'],
  structured_data: ['schema-keys', 'text-encoding'],
  gis_mapping: ['geo-bounds', 'coordinate-crs'],
  source_code: ['line-count', 'utf8-encoding'],
  archive_compressed: ['central-directory', 'compression-header'],
  disk_image: ['partition-header', 'volume-table'],
  executable_package: ['binary-header', 'package-manifest'],
  font: ['sfnt-tables', 'glyph-metrics'],
  color_lut_sidecar: ['lut-grid', 'xmp-tags'],
  system_other: ['binary-header'],
};

function def(
  ext: string,
  name: string,
  family: FormatFamily,
  category: MediaCategory,
  mimeTypes: string[],
  opts: SeedOptions
): FileFormatDefinition {
  const viewerDefault: Record<FormatFamily, FormatViewerKind> = {
    raster_image: 'image-lightbox',
    camera_raw: 'raw-demosaic-viewer',
    vector_graphic: 'image-lightbox',
    design_layout: 'image-lightbox',
    cad_3d: '3d-preview',
    video: 'video-player',
    audio: 'audio-player',
    document: 'document-reader',
    ebook: 'document-reader',
    spreadsheet: 'spreadsheet-grid',
    presentation: 'document-reader',
    subtitle_lyric: 'document-reader',
    database: 'sqlite-inspector',
    structured_data: 'json-tree-viewer',
    gis_mapping: 'json-tree-viewer',
    source_code: 'code-viewer',
    archive_compressed: 'archive-inspector',
    disk_image: 'archive-inspector',
    executable_package: 'hex-inspector',
    font: 'font-specimen',
    color_lut_sidecar: 'code-viewer',
    system_other: 'hex-inspector',
  };

  const editorDefault: Record<FormatFamily, FormatEditorKind> = {
    raster_image: 'pixel-editor',
    camera_raw: 'raw-developer',
    vector_graphic: 'text-code-editor',
    design_layout: 'metadata-xmp-editor',
    cad_3d: 'cad-3d-editor',
    video: 'video-trimmer',
    audio: 'audio-dsp-tagger',
    document: 'text-code-editor',
    ebook: 'metadata-xmp-editor',
    spreadsheet: 'csv-table-editor',
    presentation: 'none',
    subtitle_lyric: 'text-code-editor',
    database: 'none',
    structured_data: 'text-code-editor',
    gis_mapping: 'text-code-editor',
    source_code: 'text-code-editor',
    archive_compressed: 'none',
    disk_image: 'none',
    executable_package: 'none',
    font: 'none',
    color_lut_sidecar: 'lut-adjuster',
    system_other: 'none',
  };

  return {
    extension: ext.toUpperCase(),
    aliases: (opts.aliases || []).map((a) => a.toUpperCase()),
    name,
    family,
    category,
    mimeTypes,
    magicSignatures: opts.magic || [],
    containerFormat: opts.container,
    metadataParsers: opts.parsers || DEFAULT_PARSERS[family],
    viewer: opts.viewer || viewerDefault[family],
    editor: opts.editor || editorDefault[family],
    isLossless: opts.lossless,
    isStreamable: opts.streamable ?? ['image', 'raw', 'video', 'audio', 'document', 'data'].includes(category),
    preservationGrade: opts.grade || 'LOC-Acceptable',
    description: opts.desc,
  };
}

function batchTextFormats(
  specs: Array<[string, string, string, string[]?, FormatViewerKind?, PreservationGrade?]>,
  family: FormatFamily,
  category: MediaCategory,
  defaultViewer: FormatViewerKind,
  defaultEditor: FormatEditorKind,
  gradeDefault: PreservationGrade = 'LOC-Full'
): FileFormatDefinition[] {
  return specs.map(([ext, name, mime, aliases, viewerOverride, gradeOverride]) =>
    def(ext, name, family, category, [mime], {
      aliases,
      viewer: viewerOverride || defaultViewer,
      editor: defaultEditor,
      grade: gradeOverride || gradeDefault,
      desc: `${name} (${ext}) file format`,
    })
  );
}

export function buildSeedFormatsCatalog(): FileFormatDefinition[] {
  const formats: FileFormatDefinition[] = [
    // 1. RASTER IMAGES (image)
    def('JPG', 'JPEG Image (ISO/IEC 10918)', 'raster_image', 'image', ['image/jpeg'], {
      aliases: ['JPEG', 'JPE', 'JFIF', 'JIF'],
      magic: [{ offset: 0, hex: 'FFD8FF', ascii: 'ÿØÿ' }],
      lossless: false,
      grade: 'LOC-Full',
      desc: 'Lossy compressed continuous-tone raster photography standard with EXIF/XMP segments.',
    }),
    def('PNG', 'Portable Network Graphics', 'raster_image', 'image', ['image/png'], {
      magic: [{ offset: 0, hex: '89504E470D0A1A0A', ascii: '.PNG....' }],
      lossless: true,
      grade: 'LOC-Full',
      desc: 'W3C lossless compressed raster format with alpha channel and IHDR/tEXt chunks.',
    }),
    def('APNG', 'Animated Portable Network Graphics', 'raster_image', 'image', ['image/apng'], {
      magic: [{ offset: 0, hex: '89504E470D0A1A0A', ascii: '.PNG....' }],
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'PNG extension supporting multi-frame raster animation via acTL/fcTL chunks.',
    }),
    def('GIF', 'Graphics Interchange Format', 'raster_image', 'image', ['image/gif'], {
      magic: [{ offset: 0, hex: '47494638', ascii: 'GIF8' }],
      lossless: true,
      grade: 'LOC-Full',
      desc: '8-bit indexed LZW compressed image supporting multi-frame animation and binary transparency.',
    }),
    def('WEBP', 'Google WebP Image', 'raster_image', 'image', ['image/webp'], {
      aliases: ['WBP'],
      magic: [{ offset: 0, hex: '52494646', ascii: 'RIFF' }, { offset: 8, hex: '57454250', ascii: 'WEBP' }],
      container: 'RIFF',
      lossless: false,
      grade: 'LOC-Acceptable',
      desc: 'Modern VP8/VP8L RIFF-wrapped web raster format supporting lossy, lossless, alpha, and animation.',
    }),
    def('AVIF', 'AV1 Image File Format', 'raster_image', 'image', ['image/avif'], {
      magic: [{ offset: 4, hex: '6674797061766966', ascii: 'ftypavif', brand: 'avif' }],
      container: 'ISO-BMFF',
      grade: 'LOC-Acceptable',
      desc: 'High-efficiency HDR/wide-gamut image container backed by AV1 intra-frame compression.',
    }),
    def('HEIC', 'High Efficiency Image Container (HEVC)', 'raster_image', 'image', ['image/heic', 'image/heif'], {
      aliases: ['HEIF', 'HIF'],
      magic: [{ offset: 4, hex: '6674797068656963', ascii: 'ftypheic', brand: 'heic' }],
      container: 'ISO-BMFF',
      grade: 'LOC-Acceptable',
      desc: 'ISO Base Media container encapsulating HEVC intra-coded stills, Live Photos, and depth maps.',
    }),
    def('JXL', 'JPEG XL Image', 'raster_image', 'image', ['image/jxl'], {
      magic: [{ offset: 0, hex: 'FF0A' }, { offset: 0, hex: '0000000C4A584C20', ascii: '....JXL ' }],
      grade: 'LOC-Acceptable',
      desc: 'Next-generation royalty-free image coding supporting lossless JPEG recompression and HDR.',
    }),
    def('JP2', 'JPEG 2000 Core Part 1', 'raster_image', 'image', ['image/jp2', 'image/jpx'], {
      aliases: ['J2K', 'J2C', 'JPF', 'JPX', 'JPM'],
      magic: [{ offset: 0, hex: '0000000C6A502020', ascii: '....jP  ' }],
      container: 'JP2',
      grade: 'LOC-Full',
      desc: 'Wavelet-based archival imaging standard used heavily by Library of Congress collections.',
    }),
    def('BMP', 'Windows / OS/2 Bitmap', 'raster_image', 'image', ['image/bmp', 'image/x-ms-bmp'], {
      aliases: ['DIB', 'RLE'],
      magic: [{ offset: 0, hex: '424D', ascii: 'BM' }],
      lossless: true,
      grade: 'LOC-Full',
      desc: 'Uncompressed or RLE device-independent raster bitmap image.',
    }),
    def('ICO', 'Windows Icon Resource', 'raster_image', 'image', ['image/x-icon', 'image/vnd.microsoft.icon'], {
      aliases: ['CUR'],
      magic: [{ offset: 0, hex: '00000100' }],
      desc: 'Multi-resolution Windows icon or cursor container wrapping BMP/PNG images.',
    }),
    def('ICNS', 'Apple macOS Icon Image', 'raster_image', 'image', ['image/icns'], {
      magic: [{ offset: 0, hex: '69636E73', ascii: 'icns' }],
      grade: 'Proprietary',
      desc: 'Apple icon container bundling multi-scale retina PNG/ARGB icon representations.',
    }),
    def('TGA', 'Truevision Targa Raster', 'raster_image', 'image', ['image/x-targa', 'image/x-tga'], {
      aliases: ['TARGA', 'ICB', 'VDA'],
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Truecolor 24/32-bit raster format common in game textures and video pipelines.',
    }),
    def('QOI', 'Quite OK Image Format', 'raster_image', 'image', ['image/qoi'], {
      magic: [{ offset: 0, hex: '716F6966', ascii: 'qoif' }],
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Ultra-fast lossless RGB/RGBA image format with O(N) single-pass codec.',
    }),
    def('EXR', 'OpenEXR High Dynamic Range', 'raster_image', 'image', ['image/x-exr'], {
      magic: [{ offset: 0, hex: '762F3101', ascii: 'v/1.' }],
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Academy Award-winning 16/32-bit float multi-channel VFX deep compositing image.',
    }),
    def('HDR', 'Radiance RGBE High Dynamic Range', 'raster_image', 'image', ['image/vnd.radiance'], {
      aliases: ['RGBE', 'XYZE'],
      magic: [{ offset: 0, hex: '233F52414449414E', ascii: '#?RADIAN' }],
      desc: 'Floating-point RGBE environment map and lighting image format.',
    }),
    def('DPX', 'SMPTE Digital Moving-Picture Exchange', 'raster_image', 'image', ['image/x-dpx'], {
      aliases: ['CIN'],
      magic: [{ offset: 0, hex: '53445058', ascii: 'SDPX' }, { offset: 0, hex: '58504453', ascii: 'XPDS' }],
      lossless: true,
      grade: 'LOC-Full',
      desc: 'SMPTE 268M lossless logarithmic cinema film scan and DI frame sequence format.',
    }),
    def('DDS', 'DirectDraw Surface Texture', 'raster_image', 'image', ['image/vnd-ms.dds'], {
      magic: [{ offset: 0, hex: '44445320', ascii: 'DDS ' }],
      grade: 'Proprietary',
      desc: 'GPU-ready BCn/DXTn compressed mipmapped texture & cubemap container.',
    }),
    def('KTX', 'Khronos OpenGL/Vulkan Texture', 'raster_image', 'image', ['image/ktx', 'image/ktx2'], {
      aliases: ['KTX2'],
      magic: [{ offset: 0, hex: 'AB4B5458', ascii: '.KTX' }],
      desc: 'Khronos GPU container for Basis Universal / ETC2 / ASTC supercompressed textures.',
    }),
    ...batchTextFormats(
      [
        ['PCX', 'ZSoft PC Paintbrush', 'image/x-pcx', undefined, undefined, 'Legacy'],
        ['PBM', 'Portable Bitmap (Netpbm)', 'image/x-portable-bitmap'],
        ['PGM', 'Portable Graymap (Netpbm)', 'image/x-portable-graymap'],
        ['PPM', 'Portable Pixmap (Netpbm)', 'image/x-portable-pixmap', ['PNM', 'PAM']],
        ['ASTC', 'Adaptive Scalable Texture', 'image/astc'],
        ['VTF', 'Valve Texture Format', 'image/x-vtf'],
        ['MNG', 'Multiple-image Network Graphics', 'video/x-mng'],
        ['XBM', 'X11 Bitmap C Header', 'image/x-xbitmap'],
        ['XPM', 'X11 Pixmap Text Image', 'image/x-xpixmap'],
        ['WBMP', 'Wireless Application Bitmap', 'image/vnd.wap.wbmp', undefined, undefined, 'Legacy'],
        ['BPG', 'Better Portable Graphics (HEVC)', 'image/bpg'],
        ['FLIF', 'Free Lossless Image Format', 'image/flif'],
        ['SGI', 'Silicon Graphics Image', 'image/sgi', ['RGB', 'RGBA']],
        ['RAS', 'Sun Raster Bitmap', 'image/x-cmu-raster', ['SUN']],
        ['LBM', 'Amiga IFF ILBM Image', 'image/x-ilbm', ['ILBM']],
      ],
      'raster_image',
      'image',
      'image-lightbox',
      'pixel-editor',
      'LOC-Acceptable'
    ),

    // 2. CAMERA RAW & DIGITAL NEGATIVES (raw)
    def('DNG', 'Adobe Digital Negative', 'camera_raw', 'raw', ['image/x-adobe-dng'], {
      magic: [{ offset: 0, hex: '49492A00', ascii: 'II*.' }, { offset: 0, hex: '4D4D002A', ascii: 'MM.*' }],
      container: 'TIFF-EP',
      lossless: true,
      grade: 'LOC-Full',
      desc: 'Open ISO archival camera RAW negative format preserving linear sensor CFA data and XMP.',
    }),
    def('CR2', 'Canon RAW Version 2', 'camera_raw', 'raw', ['image/x-canon-cr2'], {
      magic: [{ offset: 0, hex: '49492A00', ascii: 'II*.' }, { offset: 8, hex: '43520200', ascii: 'CR..' }],
      container: 'TIFF',
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Canon EOS 12/14-bit TIFF-based camera sensor RAW negative with embedded JPEG preview.',
    }),
    def('CR3', 'Canon RAW Version 3', 'camera_raw', 'raw', ['image/x-canon-cr3'], {
      magic: [{ offset: 4, hex: '6674797063727820', ascii: 'ftypcrx ', brand: 'crx ' }],
      container: 'ISO-BMFF',
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Modern Canon ISO-BMFF RAW negative storing CRAW/lossless streams and Dual Pixel data.',
    }),
    def('CRW', 'Canon CIFF RAW Image', 'camera_raw', 'raw', ['image/x-canon-crw'], {
      magic: [{ offset: 6, hex: '4845415043434452', ascii: 'HEAPCCDR' }],
      grade: 'Legacy',
      desc: 'Legacy Canon CIFF RAW digital camera file.',
    }),
    def('NEF', 'Nikon Electronic Format RAW', 'camera_raw', 'raw', ['image/x-nikon-nef'], {
      aliases: ['NRW'],
      magic: [{ offset: 0, hex: '49492A00', ascii: 'II*.' }, { offset: 0, hex: '4D4D002A', ascii: 'MM.*' }],
      container: 'TIFF-EP',
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Nikon DSLR/Mirrorless 12/14-bit uncompressed or lossless NEF RAW image.',
    }),
    def('ARW', 'Sony Alpha RAW Negative', 'camera_raw', 'raw', ['image/x-sony-arw'], {
      aliases: ['SRF', 'SR2'],
      magic: [{ offset: 0, hex: '49492A00', ascii: 'II*.' }],
      container: 'TIFF-EP',
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Sony Alpha DSLR/Mirrorless RAW digital negative.',
    }),
    def('RAF', 'Fujifilm X-Trans / Bayer RAW', 'camera_raw', 'raw', ['image/x-fuji-raf'], {
      magic: [{ offset: 0, hex: '46554A4946494C4D', ascii: 'FUJIFILM' }],
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Fujifilm RAF negative containing CFA header tables, embedded JPEG preview, and RAW CFA block.',
    }),
    def('RW2', 'Panasonic LUMIX RAW', 'camera_raw', 'raw', ['image/x-panasonic-rw2'], {
      aliases: ['RAW', 'RWL'],
      magic: [{ offset: 0, hex: '49495500', ascii: 'IIU.' }],
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Panasonic & Leica D-Lux/V-Lux RAW sensor file.',
    }),
    def('ORF', 'Olympus / OM System RAW', 'camera_raw', 'raw', ['image/x-olympus-orf'], {
      aliases: ['ORI'],
      magic: [{ offset: 0, hex: '4949524F', ascii: 'IIRO' }],
      lossless: true,
      grade: 'LOC-Acceptable',
      desc: 'Olympus / OM Digital Solutions ORF camera RAW file.',
    }),
    def('TIFF', 'Tagged Image File Format (Archival)', 'camera_raw', 'raw', ['image/tiff'], {
      aliases: ['TIF'],
      magic: [{ offset: 0, hex: '49492A00', ascii: 'II*.' }, { offset: 0, hex: '4D4D002A', ascii: 'MM.*' }],
      lossless: true,
      grade: 'LOC-Full',
      desc: 'ISO archival master image format supporting 16-bit integer/float depth, layers, and multi-page.',
    }),
    def('X3F', 'Sigma Foveon X3F RAW', 'camera_raw', 'raw', ['image/x-sigma-x3f'], {
      magic: [{ offset: 0, hex: '464F5662', ascii: 'FOVb' }],
      lossless: true,
      grade: 'Proprietary',
      desc: 'Sigma multi-layer Foveon X3 sensor RAW file.',
    }),
    ...batchTextFormats(
      [
        ['PEF', 'Pentax / Ricoh RAW Negative', 'image/x-pentax-pef', ['PTX']],
        ['SRW', 'Samsung NX RAW Image', 'image/x-samsung-srw'],
        ['3FR', 'Hasselblad 3FR RAW Capture', 'image/x-hasselblad-3fr', ['FFF']],
        ['IIQ', 'Phase One Intelligent Image Quality RAW', 'image/x-phaseone-iiq'],
        ['MEF', 'Mamiya Electronic RAW Format', 'image/x-mamiya-mef'],
        ['MOS', 'Leaf Aptus Digital Back RAW', 'image/x-leaf-mos'],
        ['ERF', 'Epson R-D1 RAW Negative', 'image/x-epson-erf'],
        ['DCR', 'Kodak Digital Camera RAW', 'image/x-kodak-dcr', ['KDC', 'K25']],
        ['MRW', 'Konica Minolta DiMAGE RAW', 'image/x-minolta-mrw'],
        ['GPR', 'GoPro RAW (VC-5 / DNG)', 'image/x-gopro-gpr'],
        ['BRAW', 'Blackmagic RAW Cinema Footage', 'video/x-blackmagic-braw'],
        ['R3D', 'RED Digital Cinema REDCODE RAW', 'video/x-red-r3d'],
        ['ARI', 'ARRI ALEXA Uncompressed ARRIRAW', 'image/x-arri-ari'],
        ['CINE', 'Vision Research Phantom High-Speed RAW', 'video/x-phantom-cine'],
      ],
      'camera_raw',
      'raw',
      'raw-demosaic-viewer',
      'raw-developer',
      'Proprietary'
    ),

    // 3. VECTOR GRAPHICS (image)
    def('SVG', 'Scalable Vector Graphics (XML)', 'vector_graphic', 'image', ['image/svg+xml'], {
      aliases: ['SVGZ'],
      magic: [{ offset: 0, hex: '3C737667', ascii: '<svg' }],
      editor: 'text-code-editor',
      lossless: true,
      grade: 'LOC-Full',
      desc: 'W3C XML resolution-independent 2D vector graphic standard inspectable as image or source.',
    }),
    ...batchTextFormats(
      [
        ['EPS', 'Encapsulated PostScript Vector', 'application/postscript', ['EPSF', 'EPSI']],
        ['WMF', 'Windows Metafile Vector', 'image/wmf'],
        ['EMF', 'Enhanced Windows Metafile', 'image/emf', ['EMZ']],
        ['CDR', 'CorelDRAW Vector Artwork', 'application/x-cdr', undefined, undefined, 'Proprietary'],
        ['CGM', 'Computer Graphics Metafile', 'image/cgm'],
        ['PLT', 'HPGL Plotter Vector Commands', 'application/vnd.hp-hpgl'],
        ['VSDX', 'Microsoft Visio Vector Diagram', 'application/vnd.visio', ['VSD'], 'download-only', 'Proprietary'],
        ['DRAWIO', 'Diagrams.net / Draw.io Diagram XML', 'application/vnd.jgraph.mxfile', ['DIO']],
        ['ODG', 'OpenDocument Drawing Vector', 'application/vnd.oasis.opendocument.graphics'],
        ['DIA', 'Dia Vector Diagram XML', 'application/x-dia-diagram'],
      ],
      'vector_graphic',
      'image',
      'image-lightbox',
      'text-code-editor',
      'LOC-Acceptable'
    ),

    // 4. DESIGN, LAYERED ARTWORK & PUBLISHING (archive / document)
    def('PSD', 'Adobe Photoshop Layered Document', 'design_layout', 'archive', ['image/vnd.adobe.photoshop'], {
      aliases: ['PSB', 'PSDT'],
      magic: [{ offset: 0, hex: '38425053', ascii: '8BPS' }],
      lossless: true,
      grade: 'Proprietary',
      desc: 'Adobe layered raster/vector/adjustment document with embedded color profiles and smart objects.',
    }),
    ...batchTextFormats(
      [
        ['AI', 'Adobe Illustrator Vector Artwork', 'application/illustrator', ['AIT'], 'pdf-viewer', 'Proprietary'],
        ['XCF', 'GIMP Experimental Computing Facility', 'image/x-xcf', undefined, 'image-lightbox', 'LOC-Acceptable'],
        ['KRA', 'Krita Layered Painting Document', 'application/x-krita', ['KRZ'], 'archive-inspector', 'LOC-Acceptable'],
        ['ORA', 'OpenRaster Layered Image Archive', 'image/openraster', undefined, 'archive-inspector', 'LOC-Acceptable'],
        ['CLIP', 'Clip Studio Paint Document', 'application/x-clip-studio', ['LIP'], 'download-only', 'Proprietary'],
        ['AFPHOTO', 'Serif Affinity Photo Document', 'application/x-affinity-photo', undefined, 'download-only', 'Proprietary'],
        ['AFDESIGN', 'Serif Affinity Designer Document', 'application/x-affinity-designer', undefined, 'download-only', 'Proprietary'],
        ['AFPUB', 'Serif Affinity Publisher Layout', 'application/x-affinity-publisher', undefined, 'download-only', 'Proprietary'],
        ['SKETCH', 'Sketch App Design Archive', 'application/x-sketch', undefined, 'archive-inspector', 'Proprietary'],
        ['FIG', 'Figma Local Design File', 'application/x-figma', undefined, 'download-only', 'Proprietary'],
        ['XD', 'Adobe XD Prototype Document', 'application/vnd.adobe.xd', undefined, 'archive-inspector', 'Proprietary'],
        ['INDD', 'Adobe InDesign Page Layout', 'application/x-indesign', ['IDML', 'INDT'], 'download-only', 'Proprietary'],
        ['QXP', 'QuarkXPress Publishing Layout', 'application/vnd.quark.quarkxpress', undefined, 'download-only', 'Proprietary'],
        ['PUB', 'Microsoft Publisher Layout', 'application/x-mspublisher', undefined, 'download-only', 'Legacy'],
        ['SWF', 'Adobe Shockwave Flash Legacy', 'application/x-shockwave-flash', ['FLA'], 'hex-inspector', 'Legacy'],
        ['ASE', 'Adobe Swatch Exchange Palette', 'application/x-ase', ['ACO', 'GRD', 'ABR', 'PAT'], 'hex-inspector', 'Proprietary'],
      ],
      'design_layout',
      'archive',
      'archive-inspector',
      'metadata-xmp-editor',
      'Proprietary'
    ),

    // 5. 3D MODELS, POINT CLOUDS & CAD (data)
    def('GLB', 'Binary glTF 2.0 3D Asset', 'cad_3d', 'data', ['model/gltf-binary'], {
      magic: [{ offset: 0, hex: '676C5446', ascii: 'glTF' }],
      editor: 'cad-3d-editor',
      grade: 'LOC-Full',
      desc: 'Khronos PBR binary 3D scene and animation transmission format ("JPEG of 3D").',
    }),
    ...batchTextFormats(
      [
        ['GLTF', 'GL Transmission Format JSON', 'model/gltf+json'],
        ['OBJ', 'Wavefront 3D Object Mesh', 'model/obj', ['MTL'], '3d-preview'],
        ['STL', 'Stereolithography 3D Print Mesh', 'model/stl'],
        ['FBX', 'Autodesk Filmbox 3D Scene', 'application/octet-stream', undefined, '3d-preview', 'Proprietary'],
        ['USD', 'Pixar Universal Scene Description', 'model/vnd.usd', ['USDA', 'USDC', 'USDZ']],
        ['BLEND', 'Blender 3D Project Scene', 'application/x-blender', ['BLEND1'], '3d-preview', 'LOC-Acceptable'],
        ['DAE', 'COLLADA 3D Interchange XML', 'model/vnd.collada+xml', undefined, '3d-preview'],
        ['3DS', 'Autodesk 3D Studio Mesh', 'application/x-3ds', undefined, '3d-preview', 'Legacy'],
        ['C4D', 'Maxon Cinema 4D Scene', 'application/x-c4d', undefined, 'download-only', 'Proprietary'],
        ['MA', 'Autodesk Maya ASCII / Binary', 'application/x-maya', ['MB'], 'code-viewer', 'Proprietary'],
        ['PLY', 'Polygon / Stanford Point Cloud', 'application/x-ply'],
        ['ABC', 'Alembic Baked VFX Geometry Cache', 'application/x-alembic'],
        ['STEP', 'ISO 10303 CAD Exchange Model', 'model/step', ['STP', 'STE']],
        ['IGES', 'Initial Graphics Exchange Spec CAD / NURBS', 'model/iges', ['IGS', 'NURBS'], '3d-preview', 'Legacy'],
        ['DWG', 'AutoCAD Drawing Database', 'image/vnd.dwg', undefined, '3d-preview', 'Proprietary'],
        ['DXF', 'AutoCAD Drawing Exchange Format', 'image/vnd.dxf', ['DWF', 'DWFX'], '3d-preview'],
        ['IFC', 'BuildingSMART BIM Data Model', 'model/ifc'],
        ['SKP', 'Trimble SketchUp Model', 'application/vnd.sketchup.skp', undefined, '3d-preview', 'Proprietary'],
        ['GCODE', 'CNC / 3D Printer Toolpath Commands', 'text/x.gcode', ['3MF'], '3d-preview'],
      ],
      'cad_3d',
      'data',
      '3d-preview',
      'cad-3d-editor',
      'LOC-Acceptable'
    ),

    // 6. VIDEO & CINEMA CONTAINERS (video)
    def('MP4', 'MPEG-4 Part 14 Container', 'video', 'video', ['video/mp4'], {
      aliases: ['M4V', 'MP4V', 'F4V'],
      magic: [{ offset: 4, hex: '6674797069736F6D', ascii: 'ftypisom', brand: 'isom' }, { offset: 4, hex: '667479706D703432', ascii: 'ftypmp42', brand: 'mp42' }],
      container: 'ISO-BMFF',
      grade: 'LOC-Full',
      desc: 'Universal ISO Base Media File Format streaming container for H.264/HEVC/AV1 video and AAC audio.',
    }),
    def('MOV', 'Apple QuickTime Movie Container', 'video', 'video', ['video/quicktime'], {
      aliases: ['QT', 'PRORES'],
      magic: [{ offset: 4, hex: '6674797071742020', ascii: 'ftypqt  ', brand: 'qt  ' }],
      container: 'QuickTime / ISO-BMFF',
      grade: 'LOC-Full',
      desc: 'Apple QuickTime wrapper used broadly in cinema ProRes production and camera capture.',
    }),
    def('MKV', 'Matroska Open Multimedia Container', 'video', 'video', ['video/x-matroska'], {
      aliases: ['MK3D'],
      magic: [{ offset: 0, hex: '1A45DFA3', ascii: '.Eß£' }],
      container: 'EBML',
      grade: 'LOC-Full',
      desc: 'Extensible EBML container housing unlimited video, lossless audio, chapter, and subtitle tracks.',
    }),
    def('WEBM', 'WebM Open Web Video', 'video', 'video', ['video/webm'], {
      magic: [{ offset: 0, hex: '1A45DFA3', ascii: '.Eß£' }],
      container: 'EBML',
      grade: 'LOC-Acceptable',
      desc: 'Royalty-free Matroska profile dedicated to VP8/VP9/AV1 video and Vorbis/Opus audio.',
    }),
    def('AVI', 'Audio Video Interleave', 'video', 'video', ['video/x-msvideo'], {
      aliases: ['DIVX'],
      magic: [{ offset: 0, hex: '52494646', ascii: 'RIFF' }, { offset: 8, hex: '41564920', ascii: 'AVI ' }],
      container: 'RIFF',
      grade: 'LOC-Acceptable',
      desc: 'Microsoft RIFF multimedia wrapper common in legacy capture and uncompressed RGB/YUV masters.',
    }),
    def('FLV', 'Adobe Flash Video Container', 'video', 'video', ['video/x-flv'], {
      magic: [{ offset: 0, hex: '464C5601', ascii: 'FLV.' }],
      grade: 'Legacy',
      desc: 'Legacy Macromedia/Adobe web video delivery container.',
    }),
    def('OGV', 'Ogg Theora / Opus Video', 'video', 'video', ['video/ogg'], {
      aliases: ['OGM'],
      magic: [{ offset: 0, hex: '4F676753', ascii: 'OggS' }],
      container: 'Ogg',
      grade: 'LOC-Acceptable',
      desc: 'Xiph.org open bitstream container for Ogg Theora and Dirac video streams.',
    }),
    def('MXF', 'SMPTE Material eXchange Format', 'video', 'video', ['application/mxf'], {
      magic: [{ offset: 0, hex: '060E2B34', ascii: '..+4' }],
      grade: 'LOC-Full',
      desc: 'SMPTE broadcast & cinema archival wrapper for XDCAM, DNxHD, ProRes, and IMF.',
    }),
    ...batchTextFormats(
      [
        ['WMV', 'Windows Media Video (ASF)', 'video/x-ms-wmv', ['ASF'], 'video-player', 'Proprietary'],
        ['MPG', 'MPEG-1 / MPEG-2 Program Stream', 'video/mpeg', ['MPEG', 'MPE', 'M1V', 'M2V', 'MPV'], 'video-player'],
        ['MTS', 'MPEG Transport Stream (AVCHD / TS)', 'video/mp2t', ['M2TS', 'M2T'], 'video-player'],
        ['VOB', 'DVD-Video Object Stream', 'video/dvd', ['IFO'], 'video-player', 'Legacy'],
        ['3GP', '3GPP Mobile Multimedia Container', 'video/3gpp', ['3G2'], 'video-player'],
        ['GXF', 'SMPTE General Exchange Format', 'application/gxf', undefined, 'video-player'],
        ['RM', 'RealMedia Streaming Video', 'application/vnd.rn-realmedia', ['RMVB'], 'video-player', 'Legacy'],
        ['DV', 'Digital Video Raw Camcorder Stream', 'video/x-dv', undefined, 'video-player', 'LOC-Acceptable'],
        ['WTV', 'Windows Recorded TV Show', 'video/x-ms-wtv', ['DVRMS'], 'video-player', 'Proprietary'],
        ['H264', 'Elementary AVC / H.264 Bitstream', 'video/h264', ['264'], 'video-player'],
        ['H265', 'Elementary HEVC / H.265 Bitstream', 'video/h265', ['HEVC', '265'], 'video-player'],
        ['Y4M', 'YUV4MPEG2 Raw Frame Sequence', 'video/x-yuv4mpeg', ['YUV'], 'video-player'],
        ['BIK', 'RAD Bink Game Cutscene Video', 'video/x-bink', ['BK2', 'ROQ', 'SMK', 'NUT'], 'video-player', 'Proprietary'],
      ],
      'video',
      'video',
      'video-player',
      'video-trimmer',
      'LOC-Acceptable'
    ),

    // 7. AUDIO, LOSSLESS, TRACKER & SYNTH (audio)
    def('MP3', 'MPEG-1 Audio Layer III', 'audio', 'audio', ['audio/mpeg', 'audio/mp3'], {
      aliases: ['MP2', 'MP1'],
      magic: [{ offset: 0, hex: '494433', ascii: 'ID3' }, { offset: 0, hex: 'FFFB' }],
      lossless: false,
      grade: 'LOC-Full',
      desc: 'Universal perceptual audio format with ID3v1/ID3v2 metadata frames.',
    }),
    def('WAV', 'Waveform Audio File Format (RIFF/BWF)', 'audio', 'audio', ['audio/wav', 'audio/x-wav'], {
      aliases: ['WAVE', 'BWF', 'RF64'],
      magic: [{ offset: 0, hex: '52494646', ascii: 'RIFF' }, { offset: 8, hex: '57415645', ascii: 'WAVE' }],
      container: 'RIFF',
      lossless: true,
      grade: 'LOC-Full',
      desc: 'Uncompressed Broadcast/PCM RIFF master audio format carrying sample rate, channel count, and bit depth.',
    }),
    def('FLAC', 'Free Lossless Audio Codec', 'audio', 'audio', ['audio/flac', 'audio/x-flac'], {
      magic: [{ offset: 0, hex: '664C6143', ascii: 'fLaC' }],
      lossless: true,
      grade: 'LOC-Full',
      desc: 'Open bit-exact compressed audio archive format with STREAMINFO header and Vorbis/picture blocks.',
    }),
    def('OGG', 'Ogg Vorbis / Xiph Container Audio', 'audio', 'audio', ['audio/ogg'], {
      aliases: ['OGA'],
      magic: [{ offset: 0, hex: '4F676753', ascii: 'OggS' }],
      container: 'Ogg',
      grade: 'LOC-Full',
      desc: 'Open-source Xiph Ogg bitstream container housing Vorbis, FLAC, or Speex audio.',
    }),
    def('OPUS', 'IETF Opus Interactive Audio Codec', 'audio', 'audio', ['audio/opus'], {
      aliases: ['SPX'],
      magic: [{ offset: 0, hex: '4F676753', ascii: 'OggS' }],
      container: 'Ogg',
      grade: 'LOC-Full',
      desc: 'RFC 6716 ultra-low-latency hybrid speech and high-fidelity music codec.',
    }),
    def('M4A', 'MPEG-4 Audio (AAC / ALAC)', 'audio', 'audio', ['audio/mp4', 'audio/x-m4a'], {
      aliases: ['M4B', 'M4P', 'M4R', 'ALAC', 'CAF'],
      magic: [{ offset: 4, hex: '667479704D344120', ascii: 'ftypM4A ', brand: 'M4A ' }],
      container: 'ISO-BMFF',
      grade: 'LOC-Acceptable',
      desc: 'ISO-BMFF audio-only wrapper holding AAC perceptual audio or Apple Lossless (ALAC) streams.',
    }),
    def('AIFF', 'Audio Interchange File Format', 'audio', 'audio', ['audio/aiff', 'audio/x-aiff'], {
      aliases: ['AIF', 'AIFC'],
      magic: [{ offset: 0, hex: '464F524D', ascii: 'FORM' }, { offset: 8, hex: '41494646', ascii: 'AIFF' }],
      container: 'IFF',
      lossless: true,
      grade: 'LOC-Full',
      desc: 'Apple IFF big-endian uncompressed PCM studio master audio format.',
    }),
    def('MID', 'Standard MIDI Sequence', 'audio', 'audio', ['audio/midi', 'audio/x-midi'], {
      aliases: ['MIDI', 'KAR', 'RMI'],
      magic: [{ offset: 0, hex: '4D546864', ascii: 'MThd' }],
      grade: 'LOC-Full',
      desc: 'Musical Instrument Digital Interface multi-track note/controller event sequence.',
    }),
    ...batchTextFormats(
      [
        ['AAC', 'Advanced Audio Coding ADTS Stream', 'audio/aac', ['ADTS'], 'audio-player'],
        ['WEBA', 'WebM Audio-Only Track', 'audio/webm', undefined, 'audio-player'],
        ['WMA', 'Windows Media Audio', 'audio/x-ms-wma', undefined, 'audio-player', 'Proprietary'],
        ['AMR', 'Adaptive Multi-Rate Voice Codec', 'audio/amr', ['AWB'], 'audio-player'],
        ['APE', "Monkey's Audio Lossless", 'audio/x-ape', undefined, 'audio-player', 'Proprietary'],
        ['WV', 'WavPack Hybrid Lossless Audio', 'audio/x-wavpack', undefined, 'audio-player'],
        ['TTA', 'True Audio Lossless Codec', 'audio/x-tta', ['TAK'], 'audio-player'],
        ['MPC', 'Musepack Variable Bitrate Audio', 'audio/x-musepack', ['MP+'], 'audio-player'],
        ['AC3', 'Dolby Digital Surround Stream', 'audio/ac3', ['EAC3'], 'audio-player', 'Proprietary'],
        ['DTS', 'DTS Coherent Acoustics Stream', 'audio/vnd.dts', undefined, 'audio-player', 'Proprietary'],
        ['DSF', 'DSD Stream File (1-bit SACD)', 'audio/x-dsf', ['DFF'], 'audio-player'],
        ['AU', 'Sun / NeXT Audio Stream', 'audio/basic', ['SND'], 'audio-player', 'Legacy'],
        ['MOD', 'Amiga ProTracker Module', 'audio/x-mod', ['S3M', 'XM', 'IT'], 'audio-player', 'Legacy'],
        ['SF2', 'SoundFont 2 Sample Bank', 'audio/x-soundfont', ['SFZ', 'DLS'], 'hex-inspector'],
        ['REX', 'Propellerhead ReCycle Loop', 'audio/x-rex', ['RX2', 'VOC', '8SVX'], 'hex-inspector', 'Proprietary'],
      ],
      'audio',
      'audio',
      'audio-player',
      'audio-dsp-tagger',
      'LOC-Acceptable'
    ),

    // 8. DOCUMENTS & PUBLISHING (document)
    def('PDF', 'Portable Document Format (ISO 32000)', 'document', 'document', ['application/pdf'], {
      magic: [{ offset: 0, hex: '255044462D', ascii: '%PDF-' }],
      viewer: 'pdf-viewer',
      editor: 'metadata-xmp-editor',
      grade: 'LOC-Full',
      desc: 'ISO archival fixed-layout document supporting vector fonts, forms, annotations, and PDF/A.',
    }),
    def('DOCX', 'Office Open XML Word Document', 'document', 'document', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], {
      aliases: ['DOCM', 'DOTX'],
      magic: [{ offset: 0, hex: '504B0304', ascii: 'PK..' }],
      container: 'OPC / ZIP',
      grade: 'LOC-Full',
      desc: 'ECMA-376 ZIP-packaged XML word processing document.',
    }),
    def('TXT', 'Plain Text Document', 'document', 'document', ['text/plain'], {
      aliases: ['TEXT', 'LOG', 'NFO', 'README'],
      viewer: 'document-reader',
      editor: 'text-code-editor',
      lossless: true,
      grade: 'LOC-Full',
      desc: 'Universal UTF-8/ASCII unformatted character stream.',
    }),
    def('MD', 'Markdown Rich Prose Document', 'document', 'document', ['text/markdown'], {
      aliases: ['MARKDOWN', 'MDX'],
      viewer: 'markdown-viewer',
      editor: 'text-code-editor',
      lossless: true,
      grade: 'LOC-Full',
      desc: 'Lightweight markup language supporting headings, tables, fenced code blocks, and YAML frontmatter.',
    }),
    def('GDOC', 'Google Docs Cloud Document', 'document', 'document', ['application/vnd.google-apps.document'], {
      viewer: 'document-reader',
      editor: 'none',
      desc: 'Google Workspace native cloud word-processing document.',
    }),
    ...batchTextFormats(
      [
        ['DOC', 'Microsoft Word Binary Document', 'application/msword', undefined, 'document-reader', 'Legacy'],
        ['ODT', 'OpenDocument Text Archive', 'application/vnd.oasis.opendocument.text', ['OTT'], 'document-reader'],
        ['RTF', 'Rich Text Format Interchange', 'application/rtf', undefined, 'document-reader'],
        ['RST', 'reStructuredText Technical Prose', 'text/x-rst', undefined, 'markdown-viewer'],
        ['ADOC', 'AsciiDoc Technical Manuscript', 'text/asciidoc', ['ASCIIDOC'], 'markdown-viewer'],
        ['ORG', 'GNU Emacs Org-Mode Document', 'text/x-org', undefined, 'markdown-viewer'],
        ['TEX', 'LaTeX Typesetting Source', 'application/x-tex', ['LATEX', 'BIB', 'STY', 'CLS'], 'code-viewer'],
        ['PAGES', 'Apple Pages Document Package', 'application/vnd.apple.pages', undefined, 'archive-inspector', 'Proprietary'],
        ['WPD', 'Corel WordPerfect Document', 'application/vnd.wordperfect', ['WPS'], 'document-reader', 'Legacy'],
        ['XPS', 'Open XML Paper Specification', 'application/oxps', ['OXPS'], 'archive-inspector'],
        ['DJVU', 'DjVu Scanned Document Archive', 'image/vnd.djvu', ['DJV'], 'pdf-viewer'],
        ['PS', 'Adobe PostScript Page Description', 'application/postscript', ['PRN', 'CHM', 'HLP', 'MAN'], 'code-viewer', 'Legacy'],
      ],
      'document',
      'document',
      'document-reader',
      'text-code-editor',
      'LOC-Acceptable'
    ),

    // 9. EBOOKS & COMIC ARCHIVES (document / archive)
    ...batchTextFormats(
      [
        ['EPUB', 'IDPF Electronic Publication Archive', 'application/epub+zip', undefined, 'document-reader', 'LOC-Full'],
        ['MOBI', 'Mobipocket / Kindle E-Book', 'application/x-mobipocket-ebook', ['PRC'], 'document-reader', 'Legacy'],
        ['AZW3', 'Amazon Kindle Format 8 (KF8)', 'application/vnd.amazon.ebook', ['AZW', 'KFX'], 'document-reader', 'Proprietary'],
        ['FB2', 'FictionBook 2.0 XML E-Book', 'application/x-fictionbook+xml', ['FB2Z'], 'document-reader'],
        ['CBZ', 'Comic Book ZIP Archive', 'application/vnd.comicbook+zip', ['CBR', 'CB7', 'CBT'], 'archive-inspector'],
        ['LIT', 'Microsoft Reader Legacy E-Book', 'application/x-ms-reader', ['LRF'], 'download-only', 'Legacy'],
      ],
      'ebook',
      'document',
      'document-reader',
      'none',
      'LOC-Acceptable'
    ),

    // 10. SPREADSHEETS (document)
    def('CSV', 'Comma-Separated Values Table', 'spreadsheet', 'document', ['text/csv'], {
      aliases: ['TSV', 'TAB'],
      viewer: 'spreadsheet-grid',
      editor: 'csv-table-editor',
      lossless: true,
      grade: 'LOC-Full',
      desc: 'RFC 4180 plain-text tabular exchange format with automatic column & delimiter inference.',
    }),
    def('XLSX', 'Office Open XML Spreadsheet', 'spreadsheet', 'document', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], {
      aliases: ['XLSM', 'XLSB', 'XLTX'],
      magic: [{ offset: 0, hex: '504B0304', ascii: 'PK..' }],
      container: 'OPC / ZIP',
      viewer: 'spreadsheet-grid',
      editor: 'none',
      grade: 'LOC-Full',
      desc: 'ECMA-376 OpenXML workbook supporting multiple worksheets, formulas, and tables.',
    }),
    ...batchTextFormats(
      [
        ['XLS', 'Microsoft Excel Binary BIFF Workbook', 'application/vnd.ms-excel', ['XLT'], 'spreadsheet-grid', 'Legacy'],
        ['ODS', 'OpenDocument Spreadsheet', 'application/vnd.oasis.opendocument.spreadsheet', ['OTS'], 'spreadsheet-grid'],
        ['NUMBERS', 'Apple Numbers Workbook', 'application/vnd.apple.numbers', undefined, 'archive-inspector', 'Proprietary'],
        ['DIF', 'Data Interchange Format Spreadsheet', 'text/plain', ['SLK', 'WK1', 'WK3', 'WK4'], 'spreadsheet-grid', 'Legacy'],
        ['GSHEET', 'Google Sheets Cloud Workbook', 'application/vnd.google-apps.spreadsheet', undefined, 'spreadsheet-grid'],
      ],
      'spreadsheet',
      'document',
      'spreadsheet-grid',
      'csv-table-editor',
      'LOC-Acceptable'
    ),

    // 11. PRESENTATIONS (document)
    ...batchTextFormats(
      [
        ['PPTX', 'Office Open XML Presentation', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ['PPTM', 'PPSX', 'POTX'], 'document-reader', 'LOC-Full'],
        ['PPT', 'Microsoft PowerPoint Binary Deck', 'application/vnd.ms-powerpoint', ['PPS', 'POT'], 'document-reader', 'Legacy'],
        ['ODP', 'OpenDocument Presentation', 'application/vnd.oasis.opendocument.presentation', ['OTP'], 'document-reader'],
        ['KEY', 'Apple Keynote Presentation', 'application/vnd.apple.keynote', undefined, 'archive-inspector', 'Proprietary'],
        ['GSLIDES', 'Google Slides Cloud Deck', 'application/vnd.google-apps.presentation', undefined, 'document-reader'],
      ],
      'presentation',
      'document',
      'document-reader',
      'none',
      'LOC-Acceptable'
    ),

    // 12. SUBTITLES & SYNCHRONIZED LYRICS (document)
    ...batchTextFormats(
      [
        ['SRT', 'SubRip Video Subtitle Cues', 'application/x-subrip'],
        ['VTT', 'W3C WebVTT Captions & Chapters', 'text/vtt'],
        ['ASS', 'Advanced SubStation Alpha Script', 'text/x-ssa', ['SSA']],
        ['LRC', 'Synchronized Karaoke Lyrics File', 'application/x-lrc'],
        ['SUB', 'MicroDVD / VobSub Subtitle Track', 'text/x-microdvd', ['IDX', 'SBV', 'SMI']],
        ['TTML', 'W3C Timed Text Markup Language', 'application/ttml+xml', ['DFXP']],
      ],
      'subtitle_lyric',
      'document',
      'document-reader',
      'text-code-editor',
      'LOC-Full'
    ),

    // 13. DATABASES (data)
    def('SQLITE', 'SQLite 3 Relational Database', 'database', 'data', ['application/vnd.sqlite3', 'application/x-sqlite3'], {
      aliases: ['SQLITE3', 'DB', 'DB3', 'S3DB', 'SL3'],
      magic: [{ offset: 0, hex: '53514C69746520666F726D6174203300', ascii: 'SQLite format 3' }],
      viewer: 'sqlite-inspector',
      editor: 'none',
      grade: 'LOC-Full',
      desc: 'Library of Congress recommended single-file transactional SQL database with binary header metadata.',
    }),
    ...batchTextFormats(
      [
        ['DUCKDB', 'DuckDB Analytical OLAP Database', 'application/x-duckdb', undefined, 'sqlite-inspector'],
        ['MDB', 'Microsoft Access Jet Database', 'application/x-msaccess', undefined, 'sqlite-inspector', 'Legacy'],
        ['ACCDB', 'Microsoft Access ACE Database', 'application/msaccess', ['ACCDE', 'ACCDR'], 'sqlite-inspector', 'Proprietary'],
        ['DBF', 'dBase / FoxPro / Shapefile Table', 'application/x-dbf', undefined, 'spreadsheet-grid'],
        ['FDB', 'Firebird / InterBase Database', 'application/x-firebird', ['GDB'], 'hex-inspector'],
        ['MDF', 'SQL Server Primary Database File', 'application/x-mssql-mdf', ['LDF', 'NDF'], 'hex-inspector', 'Proprietary'],
        ['IBD', 'MySQL / InnoDB Tablespace File', 'application/x-mysql-ibd', ['FRM', 'MYD', 'MYI'], 'hex-inspector'],
        ['RDB', 'Redis Snapshot Persistence Dump', 'application/x-redis-rdb', undefined, 'hex-inspector'],
        ['REALM', 'MongoDB Realm Mobile Database', 'application/x-realm', ['LMDB', 'LEVELDB'], 'hex-inspector'],
        ['KDBX', 'KeePass 2.x Encrypted Vault', 'application/x-keepass2', ['KDB'], 'hex-inspector'],
        ['BSON', 'Binary JSON MongoDB Dump', 'application/bson', ['ODB'], 'hex-inspector'],
      ],
      'database',
      'data',
      'sqlite-inspector',
      'none',
      'LOC-Acceptable'
    ),

    // 14. STRUCTURED DATA, SCIENTIFIC, AI WEIGHTS & MAIL (data)
    def('JSON', 'JavaScript Object Notation (RFC 8259)', 'structured_data', 'data', ['application/json'], {
      aliases: ['JSONL', 'NDJSON', 'JSON5', 'JSONC', 'HAR', 'DTBACKUP'],
      viewer: 'json-tree-viewer',
      editor: 'text-code-editor',
      grade: 'LOC-Full',
      desc: 'Universal structured key/value & array data interchange format.',
    }),
    def('XML', 'Extensible Markup Language (W3C)', 'structured_data', 'data', ['application/xml', 'text/xml'], {
      aliases: ['XSD', 'XSLT', 'DTD', 'PLIST', 'RSS', 'ATOM'],
      magic: [{ offset: 0, hex: '3C3F786D6C', ascii: '<?xml' }],
      viewer: 'code-viewer',
      editor: 'text-code-editor',
      grade: 'LOC-Full',
      desc: 'Structured schema-validated hierarchical markup format.',
    }),
    def('PARQUET', 'Apache Parquet Columnar Store', 'structured_data', 'data', ['application/vnd.apache.parquet'], {
      magic: [{ offset: 0, hex: '50415231', ascii: 'PAR1' }],
      viewer: 'spreadsheet-grid',
      editor: 'none',
      grade: 'LOC-Acceptable',
      desc: 'High-efficiency compressed columnar analytics file format for big data lakes.',
    }),
    def('SAFETENSORS', 'HuggingFace SafeTensors Model Weights', 'structured_data', 'data', ['application/x-safetensors'], {
      viewer: 'json-tree-viewer',
      editor: 'none',
      desc: 'Zero-copy memory-mapped tensor weights container with validated JSON header and no pickle execution.',
    }),
    ...batchTextFormats(
      [
        ['YAML', 'YAML Ain’t Markup Language', 'application/yaml', ['YML'], 'code-viewer'],
        ['TOML', "Tom's Obvious Minimal Language", 'application/toml', undefined, 'code-viewer'],
        ['INI', 'INI / Properties Configuration File', 'text/plain', ['CFG', 'CONF', 'PROPERTIES', 'CNF', 'ENV'], 'code-viewer'],
        ['AVRO', 'Apache Avro Row Serialization Container', 'application/avro', undefined, 'hex-inspector'],
        ['ORC', 'Apache Optimized Row Columnar Store', 'application/x-orc', undefined, 'hex-inspector'],
        ['ARROW', 'Apache Arrow IPC Columnar Stream', 'application/vnd.apache.arrow.file', ['IPC', 'FEATHER'], 'spreadsheet-grid'],
        ['HDF5', 'Hierarchical Data Format v5', 'application/x-hdf5', ['H5'], 'hex-inspector', 'LOC-Full'],
        ['NC', 'NetCDF Scientific Array Dataset', 'application/x-netcdf', ['CDF', 'NC4'], 'hex-inspector', 'LOC-Full'],
        ['FITS', 'Flexible Image Transport System (Astronomy)', 'application/fits', ['FIT', 'FTS'], 'image-lightbox', 'LOC-Full'],
        ['MAT', 'MATLAB Workspace Binary Array', 'application/x-matlab-data', undefined, 'hex-inspector', 'Proprietary'],
        ['SAV', 'IBM SPSS Statistics Dataset', 'application/x-spss-sav', ['RDS', 'RDA', 'RDATA'], 'spreadsheet-grid'],
        ['NPY', 'NumPy Binary Tensor Archive', 'application/x-npy', ['NPZ', 'PKL', 'PICKLE'], 'hex-inspector'],
        ['ONNX', 'Open Neural Network Exchange Graph', 'application/x-onnx', ['TFLITE', 'PB'], 'hex-inspector'],
        ['GGUF', 'GGML Quantized LLM Weights Format', 'application/x-gguf', ['PT', 'PTH'], 'hex-inspector'],
        ['EML', 'RFC 5322 Internet Email Message', 'message/rfc822', ['MBOX', 'MSG', 'PST', 'OST'], 'document-reader'],
        ['VCF', 'vCard Electronic Contact Card', 'text/vcard', ['VCARD'], 'document-reader'],
        ['ICS', 'iCalendar Schedule Event File', 'text/calendar', ['ICAL', 'IFB'], 'document-reader'],
      ],
      'structured_data',
      'data',
      'json-tree-viewer',
      'text-code-editor',
      'LOC-Acceptable'
    ),

    // 15. GIS, GPS & SPATIAL TOPOLOGY (data)
    ...batchTextFormats(
      [
        ['GEOJSON', 'GeoJSON Geographic Feature Collection', 'application/geo+json', ['TOPOJSON', 'WKT'], 'json-tree-viewer', 'LOC-Full'],
        ['GPX', 'GPS Exchange Format Tracks & Waypoints', 'application/gpx+xml', undefined, 'code-viewer', 'LOC-Full'],
        ['KML', 'Keyhole Markup Language Spatial XML', 'application/vnd.google-earth.kml+xml', ['GML'], 'code-viewer', 'LOC-Full'],
        ['KMZ', 'Compressed KML Spatial Package', 'application/vnd.google-earth.kmz', undefined, 'archive-inspector'],
        ['SHP', 'ESRI Shapefile Spatial Vector Geometry', 'application/x-shapefile', ['SHX', 'PRJ', 'GPKG'], 'hex-inspector'],
        ['OSM', 'OpenStreetMap XML / PBF Map Data', 'application/vnd.openstreetmap.data+xml', ['PBF', 'MIF'], 'heightmap-viewer'],
        ['GRAPHML', 'GraphML Topology Graph XML', 'application/graphml+xml', undefined, 'code-viewer', 'LOC-Full'],
        ['DOT', 'Graphviz DOT Graph Description', 'text/vnd.graphviz', ['GV'], 'code-viewer', 'LOC-Full'],
      ],
      'gis_mapping',
      'data',
      'code-viewer',
      'text-code-editor',
      'LOC-Acceptable'
    ),
    def('HGT', 'NASA SRTM Elevation Heightmap Grid', 'gis_mapping', 'data', ['application/octet-stream'], {
      aliases: ['SRTM'],
      parsers: ['heightfield-16bit', 'geo-bounds'],
      viewer: 'heightmap-viewer',
      editor: 'heightmap-terrain-editor',
      lossless: true,
      grade: 'LOC-Full',
      desc: 'NASA Shuttle Radar Topography Mission 16-bit signed integer elevation heightfield.',
    }),
    def('DEM', 'Digital Elevation Model / Terrain Grid', 'gis_mapping', 'data', ['text/plain'], {
      aliases: ['ASC', 'TER', 'BT', 'R16', 'R32', 'HFZ'],
      parsers: ['heightfield-grid', 'geo-bounds', 'contour-isolines'],
      viewer: 'heightmap-viewer',
      editor: 'heightmap-terrain-editor',
      lossless: true,
      grade: 'LOC-Full',
      desc: 'USGS DEM, ESRI ASCII Grid, Terragen, VTP Binary Terrain, and 16/32-bit heightfield elevation maps.',
    }),

    // 16. SOURCE CODE, CONFIGS & GPU SHADERS (document)
    ...batchTextFormats(
      [
        ['TS', 'TypeScript Source Module', 'text/typescript', ['CTS']],
        ['TSX', 'TypeScript React JSX Component', 'text/tsx'],
        ['JS', 'JavaScript ES Module / Script', 'application/javascript', ['MJS', 'CJS']],
        ['JSX', 'JavaScript React JSX Component', 'text/jsx'],
        ['PY', 'Python Source Script', 'text/x-python', ['PYW', 'PYI']],
        ['IPYNB', 'Jupyter Interactive Notebook JSON', 'application/x-ipynb+json', undefined, 'json-tree-viewer'],
        ['RS', 'Rust Systems Source Code', 'text/x-rust'],
        ['GO', 'Go Language Source File', 'text/x-go'],
        ['C', 'C Systems Programming Source', 'text/x-csrc', ['H']],
        ['CPP', 'C++ Systems Source & Headers', 'text/x-c++src', ['CC', 'CXX', 'HPP', 'HH', 'HXX']],
        ['CS', 'C# .NET Source File', 'text/x-csharp'],
        ['JAVA', 'Java Source Class File', 'text/x-java-source'],
        ['KT', 'Kotlin / Script Source', 'text/x-kotlin', ['KTS']],
        ['SCALA', 'Scala JVM / Functional Source', 'text/x-scala'],
        ['SWIFT', 'Apple Swift Source Module', 'text/x-swift'],
        ['RB', 'Ruby Script Source', 'text/x-ruby'],
        ['PHP', 'PHP Hypertext Preprocessor', 'application/x-httpd-php'],
        ['PL', 'Perl Source Script', 'text/x-perl', ['PM']],
        ['LUA', 'Lua Embedded Script', 'text/x-lua'],
        ['R', 'R Statistical Computing Script', 'text/x-r-source', ['JL', 'DART', 'ZIG', 'NIM']],
        ['EX', 'Elixir Functional Source', 'text/x-elixir', ['EXS', 'ERL', 'HS', 'ML', 'CLJ', 'GROOVY']],
        ['SH', 'POSIX / Bash / Zsh Shell Script', 'application/x-sh', ['BASH', 'ZSH', 'FISH']],
        ['PS1', 'Windows PowerShell Script', 'application/x-powershell', ['PSM1', 'BAT', 'CMD']],
        ['SQL', 'Structured Query Language Script', 'application/sql'],
        ['GRAPHQL', 'GraphQL API Schema & Queries', 'application/graphql', ['GQL', 'PROTO', 'THRIFT']],
        ['HTML', 'HyperText Markup Language', 'text/html', ['HTM', 'XHTML']],
        ['CSS', 'Cascading Style Sheets', 'text/css', ['SCSS', 'SASS', 'LESS']],
        ['VUE', 'Vue Single-File Component', 'text/x-vue', ['SVELTE', 'ASTRO']],
        ['DOCKERFILE', 'Container Build Definition', 'text/plain', ['MAKEFILE', 'CMAKE', 'GRADLE', 'NIX', 'TF', 'HCL']],
      ],
      'source_code',
      'document',
      'code-viewer',
      'text-code-editor',
      'LOC-Full'
    ),
    def('GLSL', 'OpenGL / WebGL / WGSL GPU Shader Source', 'source_code', 'document', ['text/x-glsl'], {
      aliases: ['VERT', 'FRAG', 'FS', 'VS', 'HLSL', 'WGSL', 'FX', 'SHADER', 'CSH'],
      parsers: ['line-count', 'utf8-encoding', 'shader-uniforms'],
      viewer: 'shader-viewer',
      editor: 'shader-editor',
      lossless: true,
      streamable: true,
      grade: 'LOC-Full',
      desc: 'OpenGL GLSL, WebGPU WGSL, HLSL, and Shadertoy GPU fragment/vertex shader source.',
    }),

    // 17. ARCHIVES & COMPRESSION (archive)
    def('ZIP', 'ZIP Archive (PKWARE)', 'archive_compressed', 'archive', ['application/zip'], {
      aliases: ['ZIPX', 'WAR', 'EAR', 'XPI', 'CRX'],
      magic: [{ offset: 0, hex: '504B0304', ascii: 'PK..' }],
      grade: 'LOC-Full',
      desc: 'Universal deflate-compressed multi-file archive with central directory index.',
    }),
    def('7Z', '7-Zip LZMA2 Archive', 'archive_compressed', 'archive', ['application/x-7z-compressed'], {
      magic: [{ offset: 0, hex: '377ABCAF271C', ascii: "7z¼¯'." }],
      grade: 'LOC-Acceptable',
      desc: 'High-ratio open-source solid archive format using LZMA/LZMA2 compression.',
    }),
    def('RAR', 'Roshal RAR5 Archive', 'archive_compressed', 'archive', ['application/vnd.rar'], {
      aliases: ['REV'],
      magic: [{ offset: 0, hex: '526172211A07', ascii: 'Rar!..' }],
      grade: 'Proprietary',
      desc: 'Multi-volume archive container supporting recovery records and AES encryption.',
    }),
    def('TAR', 'POSIX Tape Archive (ustar)', 'archive_compressed', 'archive', ['application/x-tar'], {
      aliases: ['CPIO', 'AR', 'A'],
      magic: [{ offset: 257, hex: '7573746172', ascii: 'ustar' }],
      grade: 'LOC-Full',
      desc: 'POSIX uncompressed filesystem tape archive preserving permissions, ownership, and symlinks.',
    }),
    def('GZ', 'Gzip Compressed Stream / Tarball', 'archive_compressed', 'archive', ['application/gzip'], {
      aliases: ['GZIP', 'TGZ', 'TAR.GZ'],
      magic: [{ offset: 0, hex: '1F8B08', ascii: '...' }],
      grade: 'LOC-Full',
      desc: 'RFC 1952 DEFLATE compressed single file or POSIX .tar.gz tarball.',
    }),
    def('BZ2', 'Bzip2 Compressed Stream / Tarball', 'archive_compressed', 'archive', ['application/x-bzip2'], {
      aliases: ['BZIP2', 'TBZ2', 'TAR.BZ2'],
      magic: [{ offset: 0, hex: '425A68', ascii: 'BZh' }],
      grade: 'LOC-Acceptable',
      desc: 'Burrows-Wheeler block-sorting compressed archive stream.',
    }),
    def('XZ', 'XZ / LZMA2 Compressed Tarball', 'archive_compressed', 'archive', ['application/x-xz'], {
      aliases: ['TXZ', 'TAR.XZ', 'LZMA'],
      magic: [{ offset: 0, hex: 'FD377A585A00', ascii: 'ý7zXZ.' }],
      grade: 'LOC-Acceptable',
      desc: 'High-compression LZMA2 container for Linux distribution tarballs and firmware.',
    }),
    def('ZST', 'Zstandard Fast Compressed Archive', 'archive_compressed', 'archive', ['application/zstd'], {
      aliases: ['ZSTD', 'TZST', 'TAR.ZST'],
      magic: [{ offset: 0, hex: '28B52FFD', ascii: '(µ/ý' }],
      grade: 'LOC-Acceptable',
      desc: 'Facebook RFC 8878 high-throughput real-time lossless compression stream.',
    }),
    ...batchTextFormats(
      [
        ['LZ4', 'LZ4 Ultra-Fast Frame Compression', 'application/x-lz4', undefined, 'archive-inspector'],
        ['CAB', 'Microsoft Cabinet Package Archive', 'application/vnd.ms-cab-compressed', ['ARJ', 'LHA', 'LZH', 'ACE', 'PAR2'], 'archive-inspector', 'Legacy'],
      ],
      'archive_compressed',
      'archive',
      'archive-inspector',
      'none',
      'LOC-Acceptable'
    ),

    // 18. DISK IMAGES & VIRTUAL MACHINES (archive)
    def('ISO', 'ISO 9660 Optical Disc Image', 'disk_image', 'archive', ['application/x-iso9660-image'], {
      aliases: ['UDF'],
      magic: [{ offset: 32769, hex: '4344303031', ascii: 'CD001' }],
      grade: 'LOC-Full',
      desc: 'Standard sector-level CD/DVD/Blu-ray filesystem image.',
    }),
    ...batchTextFormats(
      [
        ['IMG', 'Raw Disk Sector Image', 'application/x-raw-disk-image', ['IMA', 'DD', 'BIN', 'CUE', 'NRG', 'MDS']],
        ['DMG', 'Apple macOS UDIF Disk Image', 'application/x-apple-diskimage', ['SPARSEIMAGE', 'SPARSEBUNDLE'], 'archive-inspector', 'Proprietary'],
        ['VHD', 'Microsoft Virtual Hard Disk', 'application/x-vhd', ['VHDX']],
        ['VMDK', 'VMware Virtual Machine Disk', 'application/x-vmdk', ['OVA', 'OVF'], 'hex-inspector', 'Proprietary'],
        ['VDI', 'VirtualBox Disk Image', 'application/x-virtualbox-vdi', undefined, 'hex-inspector'],
        ['QCOW2', 'QEMU Copy-On-Write v2 Image', 'application/x-qemu-disk', ['QCOW'], 'hex-inspector'],
        ['WIM', 'Windows Imaging Archive', 'application/x-ms-wim', ['ESD', 'SWM'], 'archive-inspector', 'Proprietary'],
      ],
      'disk_image',
      'archive',
      'archive-inspector',
      'none',
      'LOC-Acceptable'
    ),

    // 19. EXECUTABLES, BINARIES & PACKAGES (archive)
    def('WASM', 'WebAssembly Binary Module', 'executable_package', 'archive', ['application/wasm'], {
      magic: [{ offset: 0, hex: '0061736D', ascii: '.asm' }],
      viewer: 'hex-inspector',
      grade: 'LOC-Full',
      desc: 'W3C portable binary instruction format for browser and server execution.',
    }),
    def('WAT', 'WebAssembly Text Format', 'source_code', 'document', ['text/wat'], {
      viewer: 'code-viewer',
      editor: 'text-code-editor',
      grade: 'LOC-Full',
      desc: 'Human-readable S-expression text representation of WebAssembly modules.',
    }),
    def('ELF', 'Executable & Linkable Linux/UNIX Binary', 'executable_package', 'archive', ['application/x-elf'], {
      aliases: ['SO', 'APPIMAGE'],
      magic: [{ offset: 0, hex: '7F454C46', ascii: '.ELF' }],
      viewer: 'hex-inspector',
      grade: 'LOC-Full',
      desc: 'POSIX / Linux ELF shared library, executable, or portable AppImage bundle.',
    }),
    def('EXE', 'Windows PE Executable / Dynamic Library', 'executable_package', 'archive', ['application/vnd.microsoft.portable-executable'], {
      aliases: ['DLL', 'SYS', 'COM', 'SCR', 'MSI', 'MSP'],
      magic: [{ offset: 0, hex: '4D5A', ascii: 'MZ' }],
      viewer: 'hex-inspector',
      grade: 'Proprietary',
      desc: 'Microsoft Portable Executable DOS-stub MZ binary container.',
    }),
    ...batchTextFormats(
      [
        ['DYLIB', 'macOS Mach-O Dynamic Library', 'application/x-mach-binary', ['BUNDLE'], 'hex-inspector'],
        ['DEB', 'Debian / Ubuntu Software Package', 'application/vnd.debian.binary-package', undefined, 'archive-inspector'],
        ['RPM', 'RedHat / Fedora Package Archive', 'application/x-rpm', undefined, 'archive-inspector'],
        ['APK', 'Android Application Package', 'application/vnd.android.package-archive', ['AAB', 'XAPK'], 'archive-inspector'],
        ['IPA', 'Apple iOS Application Package', 'application/octet-stream', ['PKG', 'FLATPAK', 'SNAP'], 'archive-inspector', 'Proprietary'],
        ['JAR', 'Java Archive Bundle', 'application/java-archive', ['WHL', 'EGG', 'NUPKG', 'GEM', 'VSIX', 'CRATE'], 'archive-inspector'],
      ],
      'executable_package',
      'archive',
      'archive-inspector',
      'none',
      'LOC-Acceptable'
    ),

    // 20. FONTS & TYPOGRAPHY (data)
    def('WOFF2', 'W3C Web Open Font Format 2', 'font', 'data', ['font/woff2'], {
      magic: [{ offset: 0, hex: '774F4632', ascii: 'wOF2' }],
      viewer: 'font-specimen',
      grade: 'LOC-Full',
      desc: 'Brotli-compressed W3C web font container for OpenType/TrueType glyphs.',
    }),
    def('WOFF', 'W3C Web Open Font Format 1', 'font', 'data', ['font/woff'], {
      magic: [{ offset: 0, hex: '774F4646', ascii: 'wOFF' }],
      viewer: 'font-specimen',
      grade: 'LOC-Full',
      desc: 'Zlib-compressed W3C web font format wrapping SFNT tables.',
    }),
    def('OTF', 'OpenType CFF / SFNT Font', 'font', 'data', ['font/otf'], {
      magic: [{ offset: 0, hex: '4F54544F', ascii: 'OTTO' }],
      viewer: 'font-specimen',
      grade: 'LOC-Full',
      desc: 'ISO 14496-22 Open Font Format supporting PostScript cubic curves & OpenType layout features.',
    }),
    def('TTF', 'TrueType / Collection Font', 'font', 'data', ['font/ttf'], {
      aliases: ['TTC'],
      magic: [{ offset: 0, hex: '00010000' }],
      viewer: 'font-specimen',
      grade: 'LOC-Full',
      desc: 'Apple/Microsoft quadratic Bezier SFNT digital font format.',
    }),
    ...batchTextFormats(
      [
        ['EOT', 'Microsoft Embedded OpenType Font', 'application/vnd.ms-fontobject', undefined, 'font-specimen', 'Legacy'],
        ['PFB', 'Adobe Type 1 PostScript Font', 'application/x-font-type1', ['PFM', 'AFM', 'BDF', 'PCF', 'FNT', 'FON'], 'hex-inspector', 'Legacy'],
      ],
      'font',
      'data',
      'font-specimen',
      'none',
      'Legacy'
    ),

    // 21. COLOR LUTS, PROFILES & NON-DESTRUCTIVE SIDECARS (data)
    def('CUBE', 'Adobe / Iridas 3D Color LUT', 'color_lut_sidecar', 'data', ['text/plain'], {
      aliases: ['3DL', 'LOOK', 'CSP'],
      viewer: 'code-viewer',
      editor: 'lut-adjuster',
      grade: 'LOC-Full',
      desc: 'Plain-text 1D/3D floating-point RGB color lookup table used across grading & photo studios.',
    }),
    def('ICC', 'ICC Color Management Profile', 'color_lut_sidecar', 'data', ['application/vnd.iccprofile'], {
      aliases: ['ICM'],
      magic: [{ offset: 36, hex: '61637370', ascii: 'acsp' }],
      viewer: 'hex-inspector',
      editor: 'none',
      grade: 'LOC-Full',
      desc: 'ISO 15076 International Color Consortium device characterization profile (sRGB, Display P3, CMYK).',
    }),
    def('XMP', 'Adobe Extensible Metadata Platform Sidecar', 'color_lut_sidecar', 'data', ['application/rdf+xml'], {
      aliases: ['EXIF', 'LRTEMPLATE', 'AAE', 'THM', 'ACV'],
      viewer: 'code-viewer',
      editor: 'metadata-xmp-editor',
      grade: 'LOC-Full',
      desc: 'ISO 16684 RDF/XML non-destructive curation, ratings, crop, and color-edit sidecar file.',
    }),

    // 22. SYSTEM, SECURITY, NETWORK & DIAGNOSTIC FILES (data)
    ...batchTextFormats(
      [
        ['PCAP', 'Network Packet Capture (Libpcap)', 'application/vnd.tcpdump.pcap', ['PCAPNG'], 'hex-inspector', 'LOC-Full'],
        ['PEM', 'Privacy-Enhanced Mail X.509 Certificate / Key', 'application/x-pem-file', ['CRT', 'CER', 'DER', 'CSR'], 'code-viewer', 'LOC-Full'],
        ['P12', 'PKCS #12 Cryptographic Archive', 'application/x-pkcs12', ['PFX', 'GPG', 'PGP'], 'hex-inspector'],
        ['TORRENT', 'BitTorrent Bencode Metainfo File', 'application/x-bittorrent', undefined, 'hex-inspector'],
        ['DESKTOP', 'Freedesktop Launcher / Shortcut', 'application/x-desktop', ['LNK', 'URL', 'WEBLOC', 'SERVICE'], 'code-viewer'],
        ['REG', 'Windows Registry Import Script', 'text/plain', ['INF', 'DS_STORE'], 'code-viewer'],
        ['BAK', 'Backup / Temporary / Crash Dump', 'application/octet-stream', ['OLD', 'TMP', 'SWP', 'DMP', 'MDMP', 'CORE', 'PID', 'LOCK'], 'hex-inspector', 'Legacy'],
        ['HEX', 'Intel HEX / Motorola SREC Firmware Image', 'text/plain', ['SREC'], 'code-viewer'],
      ],
      'system_other',
      'data',
      'hex-inspector',
      'none',
      'LOC-Acceptable'
    ),
  ];

  // Deterministic alphabetical sort by primary extension
  formats.sort((a, b) => a.extension.localeCompare(b.extension));
  return formats;
}

export function validateFormatsList(formats: FileFormatDefinition[]): string[] {
  const errors: string[] = [];
  const seenPrimary = new Set<string>();
  const seenAny = new Map<string, string>();
  const validCategories = new Set(['image', 'raw', 'video', 'audio', 'archive', 'document', 'data']);

  for (const f of formats) {
    if (!f.extension || f.extension !== f.extension.toUpperCase()) {
      errors.push(`Invalid primary extension "${f.extension}"`);
    }
    if (seenPrimary.has(f.extension)) {
      errors.push(`Duplicate primary extension: ${f.extension}`);
    }
    seenPrimary.add(f.extension);

    const allExt = [f.extension, ...(f.aliases || [])];
    for (const token of allExt) {
      const prevOwner = seenAny.get(token);
      if (prevOwner && prevOwner !== f.extension) {
        errors.push(`Extension collision: ${token} claimed by both ${prevOwner} and ${f.extension}`);
      }
      seenAny.set(token, f.extension);
    }

    if (!validCategories.has(f.category)) {
      errors.push(`Invalid category "${f.category}" on ${f.extension}`);
    }

    for (const sig of f.magicSignatures || []) {
      if (!/^[0-9A-Fa-f]+$/.test(sig.hex) || sig.hex.length % 2 !== 0) {
        errors.push(`Invalid hex magic signature "${sig.hex}" on ${f.extension}`);
      }
    }
  }

  return errors;
}

export function createDatabaseDocument(formats: FileFormatDefinition[]): FileFormatDatabaseDocument {
  const sorted = [...formats].sort((a, b) => a.extension.localeCompare(b.extension));
  const uniqueTokens = new Set<string>();
  for (const f of sorted) {
    uniqueTokens.add(f.extension);
    for (const alias of f.aliases) uniqueTokens.add(alias);
  }
  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceStandards: [
      'FileInfo.com Extension Taxonomy',
      'Library of Congress Sustainability of Digital Formats (FDD)',
      'Wikipedia List of File Formats',
      'Voidtools Everything Filter Taxonomy',
      'IANA Media Types Registry',
      'FileFormat.info & Aspose Format Specifications',
    ],
    totalFormats: sorted.length,
    totalExtensionsAndAliases: uniqueTokens.size,
    formats: sorted,
  };
}

export function readExistingDatabaseOrSeed(): FileFormatDatabaseDocument {
  if (fs.existsSync(DB_PATH)) {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw) as FileFormatDatabaseDocument;
  }
  return createDatabaseDocument(buildSeedFormatsCatalog());
}

export function writeDatabaseDocument(doc: FileFormatDatabaseDocument): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

async function runCli() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'stats';

  if (cmd === 'build') {
    const seed = buildSeedFormatsCatalog();
    const errors = validateFormatsList(seed);
    if (errors.length > 0) {
      console.error('Validation failed:\n', errors.join('\n'));
      process.exit(1);
    }
    const doc = createDatabaseDocument(seed);
    writeDatabaseDocument(doc);
    console.log(
      `[formatDbTool] Built ${DB_PATH} with ${doc.totalFormats} canonical formats (${doc.totalExtensionsAndAliases} extensions & aliases).`
    );
    return;
  }

  if (cmd === 'validate') {
    const doc = readExistingDatabaseOrSeed();
    const errors = validateFormatsList(doc.formats);
    if (errors.length > 0) {
      console.error(`[formatDbTool] FAILED validation (${errors.length} errors):\n${errors.join('\n')}`);
      process.exit(1);
    }
    console.log(
      `[formatDbTool] OK: ${doc.formats.length} canonical formats, ${doc.totalExtensionsAndAliases} indexed extensions/aliases, 0 collisions.`
    );
    return;
  }

  if (cmd === 'stats') {
    const doc = readExistingDatabaseOrSeed();
    const byFamily: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const f of doc.formats) {
      byFamily[f.family] = (byFamily[f.family] || 0) + 1;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    }
    console.log(JSON.stringify({
      schemaVersion: doc.schemaVersion,
      totalFormats: doc.totalFormats,
      totalExtensionsAndAliases: doc.totalExtensionsAndAliases,
      byCategory,
      byFamily,
    }, null, 2));
    return;
  }

  if (cmd === 'lookup') {
    const target = args[1];
    if (!target) {
      console.error('Usage: npx tsx scripts/formatDbTool.ts lookup <ext-or-filepath>');
      process.exit(1);
    }
    const { classifyFile } = await import('../src/services/fileFormatEngine');
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      const fd = fs.openSync(target, 'r');
      const buf = Buffer.alloc(4096);
      const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
      fs.closeSync(fd);
      const header = new Uint8Array(buf.buffer, buf.byteOffset, bytesRead);
      const stat = fs.statSync(target);
      const sampleText = bytesRead > 0 ? Buffer.from(header).toString('utf8') : undefined;
      const result = classifyFile({
        filename: path.basename(target),
        sizeBytes: stat.size,
        modifiedTime: stat.mtime.toISOString(),
        headerBytes: header,
        textSample: sampleText,
      });
      console.log(JSON.stringify(result, null, 2));
    } else {
      const result = classifyFile({ filename: target.includes('.') ? target : `sample.${target.toLowerCase()}` });
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  if (cmd === 'upsert') {
    const flags = parseFlags(args.slice(1));
    if (!flags.ext || !flags.name || !flags.family || !flags.category) {
      console.error('Usage: upsert --ext EXT --name "Name" --family family --category category [--mime mime] [--viewer viewer] [--editor editor] [--desc desc]');
      process.exit(1);
    }
    const doc = readExistingDatabaseOrSeed();
    const ext = flags.ext.replace(/^\./, '').toUpperCase();
    const newEntry = def(
      ext,
      flags.name,
      flags.family as FormatFamily,
      flags.category as MediaCategory,
      flags.mime ? flags.mime.split(',').map((s) => s.trim()) : [`application/x-${ext.toLowerCase()}`],
      {
        aliases: flags.aliases ? flags.aliases.split(',').map((s) => s.trim().toUpperCase()) : [],
        viewer: flags.viewer as FormatViewerKind | undefined,
        editor: flags.editor as FormatEditorKind | undefined,
        desc: flags.desc || `${flags.name} (${ext})`,
      }
    );
    const filtered = doc.formats.filter((f) => f.extension !== ext);
    filtered.push(newEntry);
    const errors = validateFormatsList(filtered);
    if (errors.length > 0) {
      console.error('Upsert validation failed:\n', errors.join('\n'));
      process.exit(1);
    }
    const updatedDoc = createDatabaseDocument(filtered);
    writeDatabaseDocument(updatedDoc);
    console.log(`[formatDbTool] Upserted ${ext} -> ${updatedDoc.totalFormats} formats total.`);
    return;
  }

  console.error(`Unknown subcommand "${cmd}". Supported: build | validate | stats | lookup | upsert`);
  process.exit(1);
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error('[formatDbTool] Error:', err);
    process.exit(1);
  });
}
