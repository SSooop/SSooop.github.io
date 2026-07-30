/**
 * Schema.org TypeScript Interfaces
 *
 * Type definitions for structured data markup
 * Based on: https://schema.org/docs/schemas.html
 */

// Base interface for all schema types
export interface BaseSchema {
  '@context'?: string;
  '@id'?: string;
  '@type': string;
}

export interface EntityReference {
  '@id': string;
  '@type'?: string;
  name?: string;
  url?: string;
}

// WebSite Schema
export interface WebSiteSchema extends BaseSchema {
  '@type': 'WebSite';
  name: string;
  url: string;
  description?: string;
  alternateName?: string | string[];
  author?: PersonSchema | OrganizationSchema | EntityReference;
  creator?: PersonSchema | OrganizationSchema | EntityReference;
  publisher?: PersonSchema | OrganizationSchema | EntityReference;
  inLanguage?: string | string[];
  potentialAction?: SearchActionSchema;
}

// SearchAction for WebSite
export interface SearchActionSchema {
  '@type': 'SearchAction';
  target: string;
  'query-input'?: string;
}

// Person Schema
export interface PersonSchema extends BaseSchema {
  '@type': 'Person';
  name: string;
  alternateName?: string | string[];
  url?: string;
  image?: string;
  sameAs?: string[]; // Social media links
  jobTitle?: string;
  description?: string;
  worksFor?: OrganizationSchema;
  email?: string;
  birthDate?: string; // ISO date format
  birthPlace?: PlaceSchema;
  nationality?: string;
  knowsAbout?: string[]; // Topics of expertise
  inLanguage?: string | string[];
}

// Organization Schema
export interface OrganizationSchema extends BaseSchema {
  '@type': 'Organization';
  name: string;
  alternateName?: string | string[];
  url?: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  founder?: PersonSchema | EntityReference;
  inLanguage?: string | string[];
}

// BlogPosting Schema (extends Article)
export interface BlogPostingSchema extends BaseSchema {
  '@type': 'BlogPosting';
  headline: string;
  description?: string;
  image?: string | string[];
  author: PersonSchema | OrganizationSchema | EntityReference;
  publisher?: OrganizationSchema | EntityReference;
  datePublished: string; // ISO date format
  dateModified?: string; // ISO date format
  keywords?: string | string[];
  inLanguage?: string;
  url?: string;
  mainEntityOfPage?: WebPageSchema;
  genre?: string;
  articleSection?: string;
  wordCount?: number;
  sameAs?: string[];
  isPartOf?: WebSiteSchema | EntityReference;
  copyrightHolder?: PersonSchema | OrganizationSchema | EntityReference;
}

// WebPage Schema
export interface WebPageSchema extends BaseSchema {
  '@type': 'WebPage';
  name?: string;
  url?: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  author?: PersonSchema | OrganizationSchema | EntityReference;
  publisher?: OrganizationSchema | EntityReference;
  inLanguage?: string | string[];
  isPartOf?: WebSiteSchema | EntityReference;
  about?: ThingSchema | EntityReference | Array<ThingSchema | EntityReference>;
}

// BreadcrumbList Schema
export interface BreadcrumbListSchema extends BaseSchema {
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItemSchema[];
  numberOfItems: number;
}

export interface BreadcrumbItemSchema {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string; // URL
  nextItem?: BreadcrumbItemSchema;
}

// Place Schema
export interface PlaceSchema extends BaseSchema {
  '@type': 'Place';
  name: string;
  address?: PostalAddressSchema;
  geo?: GeoCoordinatesSchema;
}

// PostalAddress Schema
export interface PostalAddressSchema extends BaseSchema {
  '@type': 'PostalAddress';
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
}

// GeoCoordinates Schema
export interface GeoCoordinatesSchema {
  latitude: number;
  longitude: number;
}

// Thing Schema (generic base type)
export interface ThingSchema extends BaseSchema {
  '@type': 'Thing';
  name: string;
  description?: string;
  url?: string;
  sameAs?: string[];
}
