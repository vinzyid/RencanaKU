<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AmbiguityFlag extends Model
{
    protected $fillable = ['prd_version_id', 'code', 'question', 'options', 'is_resolved', 'resolution_answer'];

    protected $casts = [
        'options' => 'array',
        'is_resolved' => 'boolean',
    ];

    public function prdVersion(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(PrdVersion::class);
    }
}