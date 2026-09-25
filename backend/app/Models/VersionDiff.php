<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VersionDiff extends Model
{
    protected $fillable = [
        'from_version_id',
        'to_version_id',
        'diff_data',
        'algorithm_version',
    ];

    protected $casts = [
        'diff_data' => 'array',
    ];

    public function fromVersion(): BelongsTo
    {
        return $this->belongsTo(PrdVersion::class, 'from_version_id');
    }

    public function toVersion(): BelongsTo
    {
        return $this->belongsTo(PrdVersion::class, 'to_version_id');
    }
}
